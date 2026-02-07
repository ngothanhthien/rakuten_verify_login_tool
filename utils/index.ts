export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export * from './gpuSpoof';
export * from './generateRatHash';
export * from './ratOverride';

export async function fetchGist<T = unknown>(gistUrl: string): Promise<T> {
  const response = await fetch(gistUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch gist: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  return JSON.parse(text) as T;
}

export async function fetchGistAsCustomRat(gistUrl: string): Promise<import('./ratOverride').CustomRat> {
  return fetchGist<import('./ratOverride').CustomRat>(gistUrl);
}
