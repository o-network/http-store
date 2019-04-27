declare namespace li {

  function parse(value: string): { [key: string]: string };

}

declare module "li" {
  export default li;
}
