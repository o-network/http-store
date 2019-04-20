import { Store, Fetcher } from "../store";
import { ResponseBuilderOptions } from "@opennetwork/http-representation";

export type Layer = Store | Fetcher;

export type LayerStoreOptions = {
  layers?: Layer[];
} & ResponseBuilderOptions;
