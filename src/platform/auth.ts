import { getActiveProfile, loadProfilesState } from './storage';

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
  chrome.webRequest.onCompleted.addListener(cleanupAuthAttempt, { urls: ['<all_urls>'] });
  chrome.webRequest.onErrorOccurred.addListener(cleanupAuthAttempt, { urls: ['<all_urls>'] });
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
  const credentials = getActiveProfile(await loadProfilesState()).credentials;

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

function cleanupAuthAttempt(details: { requestId: string }) {
  attemptsByRequest.delete(details.requestId);
}
