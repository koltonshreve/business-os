import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCSVUpload, mergeDataSources } from '../../../lib/data-connectors';
import type { CSVUpload, UnifiedBusinessData } from '../../../types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, repo, branch = 'main', filePath, dataType, token, existingData } = req.body;

  if (action === 'list-files') {
    // List CSV files in a repo path using GitHub API
    const { owner, repoName, error } = parseRepo(repo);
    if (error) return res.status(400).json({ error });

    const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/git/trees/${branch}?recursive=1`;
    const headers = buildHeaders(token);

    try {
      const treeRes = await fetch(apiUrl, { headers });
      if (!treeRes.ok) {
        const msg = treeRes.status === 404 ? 'Repository not found or branch does not exist.' :
                    treeRes.status === 401 ? 'Invalid or missing token for private repository.' :
                    `GitHub API error: ${treeRes.statusText}`;
        return res.status(treeRes.status).json({ error: msg });
      }
      const tree = await treeRes.json() as { tree: { path: string; type: string }[] };
      const csvFiles = tree.tree
        .filter(f => f.type === 'blob' && f.path.endsWith('.csv'))
        .map(f => f.path);
      return res.json({ files: csvFiles });
    } catch {
      return res.status(500).json({ error: 'Failed to list files' });
    }
  }

  // Default action: fetch a specific file
  if (!repo || !filePath || !dataType) {
    return res.status(400).json({ error: 'Missing required fields: repo, filePath, dataType' });
  }

  const { owner, repoName, error } = parseRepo(repo);
  if (error) return res.status(400).json({ error });

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${filePath}`;
  const headers = buildHeaders(token);

  try {
    const fileRes = await fetch(rawUrl, { headers });
    if (!fileRes.ok) {
      const msg = fileRes.status === 404
        ? `File not found: ${filePath} on branch ${branch}`
        : fileRes.status === 401
        ? 'Access denied — add a personal access token for private repos'
        : `Failed to fetch file: ${fileRes.statusText}`;
      return res.status(fileRes.status).json({ error: msg });
    }

    const content = await fileRes.text();
    const filename = filePath.split('/').pop() || filePath;

    const upload: CSVUpload = { type: dataType as CSVUpload['type'], filename, content };
    const parsed = parseCSVUpload(upload);

    // Merge with existing data
    const merged = mergeDataSources([existingData ?? {}, parsed]) as UnifiedBusinessData;
    merged.metadata.sources = [
      ...(existingData?.metadata?.sources?.filter((s: string) => !s.startsWith('GitHub:')) ?? []),
      `GitHub: ${owner}/${repoName}/${filePath}`,
    ];

    return res.json({ data: merged, rowCount: content.trim().split('\n').length - 1 });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}

function parseRepo(repo: string): { owner: string; repoName: string; error?: never } | { error: string; owner?: never; repoName?: never } {
  const urlMatch = repo.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
  if (urlMatch) return { owner: urlMatch[1], repoName: urlMatch[2] };

  const parts = repo.replace(/\.git$/, '').split('/');
  if (parts.length >= 2) return { owner: parts[0], repoName: parts[1] };

  return { error: 'Invalid repo format — use "owner/repo" or a full GitHub URL' };
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3.raw',
    'User-Agent': 'BusinessOS/1.0',
  };
  if (token) headers['Authorization'] = `token ${token}`;
  return headers;
}
