import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import type { Project } from "./protocol.js";
import { upsertProject } from "./db.js";

const PROJECT_MARKERS = [
  ".git",
  "package.json",
  "Cargo.toml",
  "pyproject.toml",
  "go.mod",
  "pubspec.yaml",
];

export async function scanProjects(devDir: string): Promise<Project[]> {
  const entries = await readdir(devDir, { withFileTypes: true });
  const projects: Project[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const projectPath = join(devDir, entry.name);
    const isProject = await detectProject(projectPath);
    if (!isProject) continue;

    const gitBranch = await getGitBranch(projectPath);
    const metadata = await extractMetadata(projectPath);

    projects.push({
      id: slugify(entry.name),
      name: entry.name,
      path: projectPath,
      gitBranch,
      lastOpenedAt: null,
      metadata,
    });
  }

  return projects;
}

async function detectProject(dir: string): Promise<boolean> {
  for (const marker of PROJECT_MARKERS) {
    try {
      await stat(join(dir, marker));
      return true;
    } catch {
      // marker not found
    }
  }
  return false;
}

async function getGitBranch(dir: string): Promise<string | null> {
  try {
    const head = await readFile(join(dir, ".git", "HEAD"), "utf-8");
    const match = head.match(/^ref: refs\/heads\/(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

async function extractMetadata(
  dir: string,
): Promise<{ description?: string; gitRemote?: string; framework?: string }> {
  const metadata: { description?: string; gitRemote?: string; framework?: string } = {};

  // Git remote
  try {
    const config = await readFile(join(dir, ".git", "config"), "utf-8");
    const urlMatch = config.match(/url\s*=\s*(.+)/);
    if (urlMatch) metadata.gitRemote = urlMatch[1].trim();
  } catch {
    // no git config
  }

  // package.json
  try {
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf-8"));
    if (pkg.description) metadata.description = pkg.description;
    metadata.framework = detectFramework(pkg);
  } catch {
    // no package.json
  }

  // Cargo.toml description
  if (!metadata.description) {
    try {
      const cargo = await readFile(join(dir, "Cargo.toml"), "utf-8");
      const descMatch = cargo.match(/description\s*=\s*"([^"]+)"/);
      if (descMatch) metadata.description = descMatch[1];
      if (!metadata.framework) metadata.framework = "rust";
    } catch {
      // no Cargo.toml
    }
  }

  // pyproject.toml
  if (!metadata.framework) {
    try {
      await stat(join(dir, "pyproject.toml"));
      metadata.framework = "python";
    } catch {
      // not python
    }
  }

  // go.mod
  if (!metadata.framework) {
    try {
      await stat(join(dir, "go.mod"));
      metadata.framework = "go";
    } catch {
      // not go
    }
  }

  return metadata;
}

function detectFramework(pkg: Record<string, unknown>): string | undefined {
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
  if (!deps) return undefined;

  if (deps["next"]) return "next";
  if (deps["expo"]) return "expo";
  if (deps["@angular/core"]) return "angular";
  if (deps["vue"]) return "vue";
  if (deps["svelte"]) return "svelte";
  if (deps["react"]) return "react";
  if (deps["express"]) return "express";
  if (deps["fastify"]) return "fastify";
  return "node";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function refreshProjects(devDir: string): Promise<Project[]> {
  const projects = await scanProjects(devDir);
  for (const project of projects) {
    upsertProject(project);
  }
  console.log(`[codepilot] Scanned ${projects.length} projects from ${devDir}`);
  return projects;
}
