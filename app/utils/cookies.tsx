import { createCookie } from "@remix-run/node"; // or "@remix-run/cloudflare"

export const customUserId = createCookie("user-custom-id");
export const userPrimaryId = createCookie("user-primary-id");
