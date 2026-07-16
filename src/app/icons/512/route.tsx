import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/appIcon";

export async function GET() {
  return new ImageResponse(<AppIconMark size={512} />, { width: 512, height: 512 });
}
