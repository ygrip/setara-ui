import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isDemo = process.env.VITE_MOCK === 'true' || process.env.BUILD_TARGET === 'demo';
const isGithubPages = process.env.GITHUB_ACTIONS === 'true';
const customDomain = process.env.SITE_CUSTOM_DOMAIN;
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';

// Custom domain → no base path (served at root)
// Project site without custom domain → base is /<repo>
const basePath = isGithubPages
  ? (customDomain ? '' : (repo ? `/${repo}` : ''))
  : '';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: isDemo
      ? adapterStatic({
          pages: 'build',
          assets: 'build',
          fallback: '404.html',
          precompress: false,
          strict: false
        })
      : adapterNode(),
    paths: {
      base: basePath
    }
  }
};

export default config;
