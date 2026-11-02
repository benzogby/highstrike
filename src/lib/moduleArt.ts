// Generated with scripts/module-art: each module's 1920x1080 key image, by module id (public/education/modules/<id>.jpg).
export const MODULE_ART = new Set([
  "chap_3CWTmEY4Gyp2daDL7lIXjr",
  "chap_5OSSc0PRT0uTAt06pxl4QJ",
  "chap_vfazTanUeGQjuSWqqGIko",
  "chap_7C6CHasZXfVegsrds9TYMj",
  "chap_6JDgS3GbNy1ZUVvtZErMOO",
  "chap_5WI3xePcmtjl1b1juDxrOz",
  "chap_5pXKLCG0Th1PI3sBONVJIU",
  "chap_2BBFG110vFGkCY6WehwhlE",
  "chap_7Bpf4OIUPBM8hUiaWZyk5H",
  "chap_5F6MVfgjHkIohlJSdDbj4o",
  "chap_7lS1hnf5GNXMKKZ9JERogq",
  "chap_1Z8j3neQzLsRnkiR7n15tF",
  "chap_3wPuCkbqGxg3RugGWsd6ri",
  "chap_hazVIteEZ2tGJTUhN019x",
  "chap_IdZcHO7IK2K8vpO8CnORl",
  "chap_7k3kGZD59f3oBOnU0ya0mV",
  "chap_1ov8pwohmNCOt67xVuZSYD",
  "chap_3Juhwk3H8Hc7sbiH0N6Uba",
]);

/** The module's key image, or null for a module without one yet. */
export const moduleArt = (id: string) => (MODULE_ART.has(id) ? `/education/modules/${id}.jpg` : null);
