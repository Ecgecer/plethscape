export type Wavelength = "green" | "red" | "infrared";
export const OPTICAL_BANDS = {
  green: {
    name: "Green",
    nm: "530 nm",
    color: 0x8de8a3,
    depth: 0.68,
    note: "Green light emphasizes shallower tissue in this illustration.",
  },
  red: {
    name: "Red",
    nm: "660 nm",
    color: 0xff8470,
    depth: 1.15,
    note: "Red light illustrates a deeper sampling region than green.",
  },
  infrared: {
    name: "Infrared",
    nm: "940 nm",
    color: 0xf3cdaa,
    depth: 1.65,
    note: "Infrared is invisible to us; warm white makes its deeper paths visible here.",
  },
};
