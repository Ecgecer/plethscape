import type { SiteId } from "./simulation";

export type WearableSite = SiteId;
export const WEARABLE_SITES: WearableSite[] = [
  "finger",
  "wrist",
  "ear",
  "forehead",
  "carotid",
  "upperarm",
  "toe",
];
export const DEVICES: Record<
  WearableSite,
  {
    name: string;
    label: string;
    detail: string;
    principle: string;
  }
> = {
  finger: {
    name: "Smart ring",
    label: "RING",
    detail: "Polished titanium · inner optical sensors",
    principle:
      "Light enters the finger. The sensor reads the changing amount reflected back as local blood volume rises and falls.",
  },
  wrist: {
    name: "Sensor band",
    label: "BAND",
    detail: "Woven strap · screenless optical module",
    principle:
      "An optical sensor beneath the band reads blood-volume changes in superficial tissue. Fit and arm movement affect the signal.",
  },
  ear: {
    name: "Sensor earring",
    label: "EARRING",
    detail: "Black huggie hoop · discreet inner optics",
    principle:
      "A light source and detector sit on opposite sides of the earlobe. The changing transmitted light produces the pulse signal.",
  },
  forehead: {
    name: "Temple sensor",
    label: "TEMPLE",
    detail: "Amber capsule · skin-fitted optical patch",
    principle:
      "A small capsule rests against one temple and illustrates reflected-light sensing in superficial tissue. Its pulse is a teaching approximation, not a calibrated temple recording.",
  },
  carotid: {
    name: "Neck patch",
    label: "NECK",
    detail: "Soft adhesive patch · side of the neck",
    principle:
      "This concept patch illustrates superficial optical sensing at the neck. The carotid reference waveform is a teaching approximation, not a direct measurement of deep arterial flow.",
  },
  upperarm: {
    name: "Bicep band",
    label: "ARM",
    detail: "Woven cuff · screenless optical module",
    principle:
      "The sensor rests against the upper arm and reads local optical blood-volume changes. Contact and motion influence the simulated signal.",
  },
  toe: {
    name: "Toe band",
    label: "TOE",
    detail: "Soft black band · inner optical sensor",
    principle:
      "The band reads reflected light from the big toe. This distal site illustrates a later pulse arrival in the teaching model.",
  },
};
export function isWearableSite(site: SiteId | string): site is WearableSite {
  return WEARABLE_SITES.includes(site as WearableSite);
}
