// Aria's mark: the bird (Ian, Oct 28). A mask, so it takes the color of the text around it:
// light on Night, dark on Sky, and it matches whatever it sits next to.
import mark from "@/assets/aria-mark.png";

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <span aria-hidden="true" style={{
      display: "inline-block", width: size, height: size, flex: "none", background: "currentColor",
      WebkitMaskImage: `url(${mark})`, maskImage: `url(${mark})`, WebkitMaskSize: "contain", maskSize: "contain",
      WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center",
    }} />
  );
}
