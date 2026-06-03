import type React from "react";
import type { Wallpaper } from "../../types/halo";

export function wallpaperBackground(wallpaper: Wallpaper) {
  return wallpaper.type === "gradient" || wallpaper.type === "category" || wallpaper.type === "url"
    ? wallpaper.value
    : "linear-gradient(135deg, #080b12 0%, #111827 52%, #0b1324 100%)";
}

export function WallpaperLayer({ wallpaper }: { wallpaper: Wallpaper }) {
  return (
    <>
      {wallpaper.type === "image" && <img className="wallpaper-media" src={wallpaper.value} alt="" />}
      {wallpaper.type === "video" && <video className="wallpaper-media" src={wallpaper.value} autoPlay muted loop playsInline />}
      {wallpaper.type === "html" && (
        <iframe className="wallpaper-frame" srcDoc={wallpaper.value} title="Live wallpaper" sandbox="allow-scripts allow-same-origin" />
      )}
    </>
  );
}

export type WallpaperStyle = React.CSSProperties & { "--accent": string };
