import type { MetadataRoute } from "next";

// PWA manifest. "Add to Home Screen" + display:fullscreen makes the controller
// launch with no browser chrome  the immersive, video-fullscreen-like view the
// controller wants, and the only route to true fullscreen on iOS.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Virtual Xbox Controller",
    short_name: "Controller",
    description: "Touch controller that drives any Python-capable device.",
    start_url: "/",
    display: "fullscreen",
    orientation: "landscape",
    background_color: "#0a0c10",
    theme_color: "#0a0c10",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
