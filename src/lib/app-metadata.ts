export const APP_VERSION = __APP_VERSION__;
export const APP_BUILD_SHA = __BUILD_SHA__;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_BUILD_LABEL = APP_BUILD_SHA === 'dev' ? 'dev' : APP_BUILD_SHA.slice(0, 12);
