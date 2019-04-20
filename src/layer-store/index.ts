import { LayerStoreOptions, Layer } from "./options";
import { Store, Fetcher } from "../store";
import { Request, Response, ResponseBuilder, PartialResponse, ResponseBuilderOptions } from "@opennetwork/http-representation";

function notAllowed() {
  return new Response(
    undefined,
    {
      // Not allowed
      status: 405
    }
  );
}

function invokeLayer(layer: Layer, request: Request, options: any) {
  if ((layer as Store).fetch) {
    return (layer as Store).fetch(request, options);
  }
  if (!(layer instanceof Function)) {
    throw new Error("Expected layer to be a function or an http-store");
  }
  return (layer as Fetcher)(request, options);
}

export * from "./options";

export class LayerStore implements Store {

  private readonly layers: Layer[] = [];

  private readonly options: LayerStoreOptions = {};

  constructor(options?: LayerStoreOptions) {
    this.options = {
      ...(options || {})
    };
    // Default ignoreSubsequentFullResponses if neither are provided
    if (typeof this.options.replaceSubsequentFullResponses !== "boolean" && typeof this.options.ignoreSubsequentFullResponses !== "boolean") {
      this.options.ignoreSubsequentFullResponses = true;
    }
    // Default useSetForEntityHeaders to true
    if (typeof this.options.useSetForEntityHeaders !== "boolean") {
      this.options.useSetForEntityHeaders = true;
    }
    // Add our default layers
    if (options && options.layers) {
      this.with(...options.layers);
    }
  }

  with(...layers: Layer[]): this {
    layers
      .filter(value => value)
      .forEach(layer => this.layers.push(layer));
    return this;
  }

  builder = async (request: Request, options?: any): Promise<ResponseBuilder> => {
    const builder = new ResponseBuilder(this.options as ResponseBuilderOptions);

    const layers = options && options.layers || this.layers;

    if (!layers.length) {
      return builder;
    }

    const runLayer = async (continuePromise: Promise<boolean>, layer: Layer, index: number, layers: Layer[]): Promise<boolean> => {
      const shouldContinue = await continuePromise;
      if (!shouldContinue) {
        return shouldContinue;
      }
      const after = layers.slice(index + 1);
      const newOptions = {
        ...(options || {}),
        layers: after,
        // Allow early fetch of
        fetchNext: (async (request: Request, options?: any): Promise<Response> => {
          const nextOptions = {
            ...newOptions,
            // Allow override of options
            ...(options || {})
          };
          return this.fetch(request, nextOptions);
        }) as Fetcher
      };
      const response = await invokeLayer(layer, request, newOptions);
      builder.with(response);
      if (!response || !this.options.ignoreSubsequentFullResponses) {
        return true;
      }
      return (response as PartialResponse).partial;
    };

    await layers.reduce(
      runLayer,
      Promise.resolve(true)
    );

    if (!builder.responses.length) {
      return builder.with(notAllowed());
    }

    return builder;
  };

  fetch = async (request: Request, options?: any): Promise<Response> => {
    const builder = await this.builder(request, options);
    if (builder.responses.length === 0) {
      return undefined;
    }
    return builder.build();
  };

}
