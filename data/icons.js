import {
  Waves, Droplets, Landmark, Feather, Mountain, MountainSnow,
  Snowflake, Wine, BookOpen, Plane, Ghost, Trees, Church, Palmtree,
} from "lucide-react";

export const ICONS = {
  waves: Waves,
  droplets: Droplets,
  landmark: Landmark,
  feather: Feather,
  mountain: Mountain,
  "mountain-snow": MountainSnow,
  snowflake: Snowflake,
  wine: Wine,
  "book-open": BookOpen,
  plane: Plane,
  ghost: Ghost,
  trees: Trees,
  church: Church,
  palmtree: Palmtree,
};

export function getIcon(key) {
  return ICONS[key] || Landmark;
}
