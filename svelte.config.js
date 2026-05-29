import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isDemo = process.env.VITE_MOCK === 'true' || process.env.BUILD_TARGET === 'demo';
const isGithubPages = process.env.GITHUB_ACTIONS === 'true';
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';

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
      base: isGithubPages && repo ? `/${repo}` : ''
    }
  }
};

export default config;
