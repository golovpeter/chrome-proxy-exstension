import { loadCredentials } from './storage';

const attemptsByRequest = new Map<string, number>();
const MAX_AUTH_ATTEMPTS = 1;

export function registerAuthHandler() {
  chrome.webRequest.onAuthRequired.addListener(
    (details, callback) => {
      void resolveAuthCredentials(details)
        .then((response) => callback?.(response))
        .catch(() => callback?.({}));

      return undefined;
    },
    { urls: ['<all_urls>'] },
    ['asyncBlocking'],
  );
}

async function resolveAuthCredentials(
  details: chrome.webRequest.OnAuthRequiredDetails,
): Promise<chrome.webRequest.BlockingResponse> {
  if (!details.isProxy) {
    return {};
  }

  const attempts = attemptsByRequest.get(details.requestId) ?? 0;
  if (attempts >= MAX_AUTH_ATTEMPTS) {
    attemptsByRequest.delete(details.requestId);
    return { cancel: false };
  }

  attemptsByRequest.set(details.requestId, attempts + 1);
  const credentials = await loadCredentials();

  if (!credentials.username || !credentials.password) {
    return {};
  }

  return {
    authCredentials: {
      username: credentials.username,
      password: credentials.password,
    },
  };
}
