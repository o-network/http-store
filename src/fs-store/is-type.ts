import { Headers } from "@opennetwork/http-representation";

export default function isType(headers: Headers, contentType: string): boolean {
  // media-type = type "/" subtype *( OWS ";" OWS parameter )
  const contentTypeValue = headers.get("Content-Type");
  if (!contentTypeValue) {
    return false;
  }
  // Content-Type = media-type
  // media-type = type "/" subtype *( OWS ";" OWS parameter )
  // parameter = token "=" ( token / quoted-string )
  //
  // Above shows we just need to check the first section to see what type we've got
  const split = contentTypeValue.split(";");
  // toLowerCase because type is a token which could contain upper case
  return split[0].trim().toLowerCase() === contentType.toLowerCase();
}
