import { useEffect, useMemo, useState } from "react";
import MarkdownIt from "markdown-it";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api, type Post } from "@/lib/api";

type ProjectMeta = {
  logoImageUrl: string;
  serviceUrl: string;
  problem: string;
  solution: string;
  impact: string;
};

type PostDraft = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  markdown: string;
  coverImage: string;
  status: "draft" | "published";
  featured: boolean;
  tagsText: string;
  projectLogoImageUrl: string;
  projectServiceUrl: string;
  projectProblem: string;
  projectSolution: string;
  projectImpact: string;
};

const markdownParser = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

const emptyProjectMeta: ProjectMeta = {
  logoImageUrl: "",
  serviceUrl: "",
  problem: "",
  solution: "",
  impact: "",
};

const PROJECT_META_COMMENT_RE = /<!--\s*PROJECT_META\s*([\s\S]*?)-->/m;
const PROJECT_SUMMARY_BLOCK_RE =
  /<!--\s*PROJECT_SUMMARY_START\s*-->[\s\S]*?<!--\s*PROJECT_SUMMARY_END\s*-->\s*/m;

const normalizeProjectMeta = (meta: Partial<ProjectMeta>): ProjectMeta => ({
  logoImageUrl: typeof meta.logoImageUrl === "string" ? meta.logoImageUrl.trim() : "",
  serviceUrl: typeof meta.serviceUrl === "string" ? meta.serviceUrl.trim() : "",
  problem: typeof meta.problem === "string" ? meta.problem.trim() : "",
  solution: typeof meta.solution === "string" ? meta.solution.trim() : "",
  impact: typeof meta.impact === "string" ? meta.impact.trim() : "",
});

const hasProjectTag = (tagsText: string) =>
  tagsText
    .split(",")
    .map(tag => tag.trim().toLowerCase())
    .some(tag => tag === "project" || tag === "projects");

const hasAnyProjectMeta = (meta: ProjectMeta) =>
  Object.values(meta).some(value => value.length > 0);

const parseProjectMarkdown = (markdown: string) => {
  const metaMatch = markdown.match(PROJECT_META_COMMENT_RE);
  let meta = emptyProjectMeta;

  if (metaMatch?.[1]) {
    try {
      const parsed = JSON.parse(metaMatch[1].trim()) as Partial<ProjectMeta>;
      meta = normalizeProjectMeta(parsed);
    } catch {
      meta = emptyProjectMeta;
    }
  }

  const body = markdown
    .replace(PROJECT_META_COMMENT_RE, "")
    .replace(PROJECT_SUMMARY_BLOCK_RE, "")
    .trimStart();

  return { meta, body };
};

const buildProjectSummaryContent = (meta: ProjectMeta) => {
  const sections: string[] = ["## Project Snapshot"];

  if (meta.logoImageUrl) {
    sections.push(`![Project Logo](${meta.logoImageUrl})`);
  }

  const links: string[] = [];
  if (meta.serviceUrl) {
    links.push(`- Service URL: [${meta.serviceUrl}](${meta.serviceUrl})`);
  }
  if (links.length > 0) {
    sections.push(links.join("\n"));
  }

  if (meta.problem) {
    sections.push(`### Problem\n${meta.problem}`);
  }
  if (meta.solution) {
    sections.push(`### Solution\n${meta.solution}`);
  }
  if (meta.impact) {
    sections.push(`### Impact\n${meta.impact}`);
  }

  return sections.join("\n\n");
};

const buildMarkdownForSave = (draft: PostDraft) => {
  const body = draft.markdown
    .replace(PROJECT_META_COMMENT_RE, "")
    .replace(PROJECT_SUMMARY_BLOCK_RE, "")
    .trim();

  if (!hasProjectTag(draft.tagsText)) {
    return body;
  }

  const projectMeta = normalizeProjectMeta({
    logoImageUrl: draft.projectLogoImageUrl,
    serviceUrl: draft.projectServiceUrl,
    problem: draft.projectProblem,
    solution: draft.projectSolution,
    impact: draft.projectImpact,
  });

  if (!hasAnyProjectMeta(projectMeta)) {
    return body;
  }

  const metaComment = [
    "<!-- PROJECT_META",
    JSON.stringify(projectMeta, null, 2),
    "-->",
  ].join("\n");

  const summaryBlock = [
    "<!-- PROJECT_SUMMARY_START -->",
    buildProjectSummaryContent(projectMeta),
    "<!-- PROJECT_SUMMARY_END -->",
  ].join("\n");

  return [metaComment, summaryBlock, body].filter(Boolean).join("\n\n");
};

const buildPreviewMarkdown = (draft: PostDraft) => {
  const body = draft.markdown
    .replace(PROJECT_META_COMMENT_RE, "")
    .replace(PROJECT_SUMMARY_BLOCK_RE, "")
    .trim();

  if (!hasProjectTag(draft.tagsText)) {
    return body;
  }

  const projectMeta = normalizeProjectMeta({
    logoImageUrl: draft.projectLogoImageUrl,
    serviceUrl: draft.projectServiceUrl,
    problem: draft.projectProblem,
    solution: draft.projectSolution,
    impact: draft.projectImpact,
  });

  if (!hasAnyProjectMeta(projectMeta)) {
    return body;
  }

  return [buildProjectSummaryContent(projectMeta), body].filter(Boolean).join("\n\n");
};

const emptyDraft = (): PostDraft => ({
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  markdown: "# New Post\n\nStart writing...",
  coverImage: "",
  status: "draft",
  featured: false,
  tagsText: "",
  projectLogoImageUrl: "",
  projectServiceUrl: "",
  projectProblem: "",
  projectSolution: "",
  projectImpact: "",
});

const toDraft = (post: Post): PostDraft => {
  const { body, meta } = parseProjectMarkdown(post.markdown);

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    markdown: body,
    coverImage: post.coverImage ?? "",
    status: post.status,
    featured: post.featured,
    tagsText: post.tags.map(tag => tag.name).join(", "),
    projectLogoImageUrl: meta.logoImageUrl,
    projectServiceUrl: meta.serviceUrl,
    projectProblem: meta.problem,
    projectSolution: meta.solution,
    projectImpact: meta.impact,
  };
};

function DashboardPage() {
  const missingAdminKey = !import.meta.env.VITE_ADMIN_API_KEY;
  const queryClient = useQueryClient();
  const [tagInput, setTagInput] = useState("");
  const [draft, setDraft] = useState<PostDraft>(emptyDraft);
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    intro: "",
    headline: "",
    bio: "",
    location: "",
    email: "",
    websiteUrl: "",
    github: "",
    linkedin: "",
    instagram: "",
  });

  const profileQuery = useQuery({
    queryKey: ["admin", "profile"],
    queryFn: api.getProfile,
  });
  const tagsQuery = useQuery({
    queryKey: ["admin", "tags"],
    queryFn: api.listTags,
  });
  const postsQuery = useQuery({
    queryKey: ["admin", "posts"],
    queryFn: () => api.listPosts(),
  });

  const saveProfileMutation = useMutation({
    mutationFn: api.saveProfile,
    onSuccess: profile => {
      queryClient.invalidateQueries({ queryKey: ["admin", "profile"] });
      if (profile) {
        setProfileForm({
          displayName: profile.displayName,
          intro: profile.intro ?? "",
          headline: profile.headline ?? "",
          bio: profile.bio ?? "",
          location: profile.location ?? "",
          email: profile.email ?? "",
          websiteUrl: profile.websiteUrl ?? "",
          github: profile.socials.github ?? "",
          linkedin: profile.socials.linkedin ?? "",
          instagram: profile.socials.instagram ?? "",
        });
      }
    },
  });

  const createTagMutation = useMutation({
    mutationFn: api.createTag,
    onSuccess: () => {
      setTagInput("");
      queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: api.deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: api.createPost,
    onSuccess: post => {
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      applyDraft(toDraft(post));
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updatePost>[1] }) =>
      api.updatePost(id, input),
    onSuccess: post => {
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      if (post) {
        applyDraft(toDraft(post));
      }
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: api.deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      applyDraft(emptyDraft());
    },
  });

  const applyDraft = (next: PostDraft) => {
    setDraft(next);
  };

  useEffect(() => {
    if (!profileQuery.data) return;
    setProfileForm({
      displayName: profileQuery.data.displayName,
      intro: profileQuery.data.intro ?? "",
      headline: profileQuery.data.headline ?? "",
      bio: profileQuery.data.bio ?? "",
      location: profileQuery.data.location ?? "",
      email: profileQuery.data.email ?? "",
      websiteUrl: profileQuery.data.websiteUrl ?? "",
      github: profileQuery.data.socials.github ?? "",
      linkedin: profileQuery.data.socials.linkedin ?? "",
      instagram: profileQuery.data.socials.instagram ?? "",
    });
  }, [profileQuery.data]);

  const isProjectMode = hasProjectTag(draft.tagsText);
  const composedMarkdown = useMemo(() => buildMarkdownForSave(draft), [draft]);
  const previewMarkdown = useMemo(() => buildPreviewMarkdown(draft), [draft]);
  const previewHtml = useMemo(
    () => markdownParser.render(previewMarkdown || "_아직 작성된 내용이 없습니다._"),
    [previewMarkdown]
  );

  const onSaveProfile = () => {
    saveProfileMutation.mutate({
      displayName: profileForm.displayName,
      intro: profileForm.intro || null,
      headline: profileForm.headline || null,
      bio: profileForm.bio || null,
      location: profileForm.location || null,
      email: profileForm.email || null,
      websiteUrl: profileForm.websiteUrl || null,
      socials: {
        github: profileForm.github || null,
        linkedin: profileForm.linkedin || null,
        instagram: profileForm.instagram || null,
      },
    });
  };

  const onSavePost = () => {
    const payload = {
      title: draft.title,
      slug: draft.slug || undefined,
      excerpt: draft.excerpt || null,
      markdown: composedMarkdown,
      coverImage: draft.coverImage || null,
      status: draft.status,
      featured: draft.featured,
      tags: draft.tagsText
        .split(",")
        .map(value => value.trim())
        .filter(Boolean),
    } as const;

    if (draft.id) {
      updatePostMutation.mutate({ id: draft.id, input: payload });
      return;
    }

    createPostMutation.mutate(payload);
  };

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1>포트폴리오 CMS 관리자</h1>
          <p>프로필, 태그, 게시글을 한 곳에서 관리합니다.</p>
          {missingAdminKey && (
            <p>
              <code>VITE_ADMIN_API_KEY</code>가 없습니다. <code>apps/admin/.env</code>에 설정해 주세요.
            </p>
          )}
        </div>
      </header>

      <section className="panel">
        <h2>프로필</h2>
        <div className="grid grid-3">
          <label>
            이름
            <input
              value={profileForm.displayName}
              onChange={e => setProfileForm(prev => ({ ...prev, displayName: e.target.value }))}
            />
          </label>
          <label>
            한줄 소개 (홈)
            <input
              value={profileForm.intro}
              onChange={e => setProfileForm(prev => ({ ...prev, intro: e.target.value }))}
            />
          </label>
          <label>
            헤드라인
            <input
              value={profileForm.headline}
              onChange={e => setProfileForm(prev => ({ ...prev, headline: e.target.value }))}
            />
          </label>
          <label>
            위치
            <input
              value={profileForm.location}
              onChange={e => setProfileForm(prev => ({ ...prev, location: e.target.value }))}
            />
          </label>
          <label>
            이메일
            <input
              type="email"
              value={profileForm.email}
              onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
            />
          </label>
          <label>
            웹사이트
            <input
              value={profileForm.websiteUrl}
              onChange={e => setProfileForm(prev => ({ ...prev, websiteUrl: e.target.value }))}
            />
          </label>
          <label>
            GitHub
            <input
              value={profileForm.github}
              onChange={e => setProfileForm(prev => ({ ...prev, github: e.target.value }))}
            />
          </label>
          <label>
            LinkedIn
            <input
              value={profileForm.linkedin}
              onChange={e => setProfileForm(prev => ({ ...prev, linkedin: e.target.value }))}
            />
          </label>
          <label>
            Instagram
            <input
              value={profileForm.instagram}
              onChange={e => setProfileForm(prev => ({ ...prev, instagram: e.target.value }))}
            />
          </label>
          <label className="full">
            소개 (마크다운 지원)
            <textarea
              rows={4}
              value={profileForm.bio}
              onChange={e => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
            />
          </label>
        </div>
        <button onClick={onSaveProfile} disabled={saveProfileMutation.isPending}>
          {saveProfileMutation.isPending ? "저장 중..." : "프로필 저장"}
        </button>
      </section>

      <section className="panel">
        <h2>태그</h2>
        <div className="row">
          <input
            placeholder="새 태그 이름"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
          />
          <button
            onClick={() => createTagMutation.mutate({ name: tagInput })}
            disabled={!tagInput.trim() || createTagMutation.isPending}
          >
            태그 추가
          </button>
        </div>
        <ul className="tag-list">
          {(tagsQuery.data ?? []).map(tag => (
            <li key={tag.id}>
              <span>{tag.name}</span>
              <button onClick={() => deleteTagMutation.mutate(tag.id)}>삭제</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel posts-layout">
        <aside>
          <div className="row">
            <h2>게시글</h2>
            <button onClick={() => applyDraft(emptyDraft())}>새 글</button>
          </div>
          <ul className="post-list">
            {(postsQuery.data ?? []).map(post => (
              <li key={post.id}>
                <button className="post-item" onClick={() => applyDraft(toDraft(post))}>
                  <strong>{post.title}</strong>
                  <span>{post.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="editor-panel">
          <div className="grid grid-2">
            <label>
              제목
              <input
                value={draft.title}
                onChange={e => setDraft(prev => ({ ...prev, title: e.target.value }))}
              />
            </label>
            <label>
              슬러그
              <input
                value={draft.slug}
                onChange={e => setDraft(prev => ({ ...prev, slug: e.target.value }))}
              />
            </label>
            <label className="full">
              요약
              <textarea
                rows={2}
                value={draft.excerpt}
                onChange={e => setDraft(prev => ({ ...prev, excerpt: e.target.value }))}
              />
            </label>
            <label>
              커버 이미지 경로/URL
              <input
                placeholder="/cover/example.webp 또는 https://..."
                value={draft.coverImage}
                onChange={e => setDraft(prev => ({ ...prev, coverImage: e.target.value }))}
              />
            </label>
            <label>
              태그 (쉼표로 구분)
              <input
                value={draft.tagsText}
                onChange={e => setDraft(prev => ({ ...prev, tagsText: e.target.value }))}
              />
            </label>
            <label>
              상태
              <select
                value={draft.status}
                onChange={e =>
                  setDraft(prev => ({
                    ...prev,
                    status: e.target.value as "draft" | "published",
                  }))
                }
              >
                <option value="draft">임시저장</option>
                <option value="published">발행</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={e => setDraft(prev => ({ ...prev, featured: e.target.checked }))}
              />
              대표 글
            </label>
            {isProjectMode && (
              <div className="full project-fields">
                <h3>프로젝트 정보</h3>
                <div className="grid grid-2">
                  <label>
                    서비스 URL
                    <input
                      placeholder="https://..."
                      value={draft.projectServiceUrl}
                      onChange={e =>
                        setDraft(prev => ({ ...prev, projectServiceUrl: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    로고 이미지 경로/URL
                    <input
                      placeholder="/logo/example.png 또는 https://..."
                      value={draft.projectLogoImageUrl}
                      onChange={e =>
                        setDraft(prev => ({ ...prev, projectLogoImageUrl: e.target.value }))
                      }
                    />
                  </label>
                  <label className="full">
                    문제
                    <textarea
                      rows={3}
                      value={draft.projectProblem}
                      onChange={e =>
                        setDraft(prev => ({ ...prev, projectProblem: e.target.value }))
                      }
                    />
                  </label>
                  <label className="full">
                    해결
                    <textarea
                      rows={3}
                      value={draft.projectSolution}
                      onChange={e =>
                        setDraft(prev => ({ ...prev, projectSolution: e.target.value }))
                      }
                    />
                  </label>
                  <label className="full">
                    성과
                    <textarea
                      rows={3}
                      value={draft.projectImpact}
                      onChange={e =>
                        setDraft(prev => ({ ...prev, projectImpact: e.target.value }))
                      }
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="markdown-grid">
            <label className="markdown-pane">
              마크다운
              <textarea
                rows={20}
                className="markdown-input"
                value={draft.markdown}
                onChange={e => setDraft(prev => ({ ...prev, markdown: e.target.value }))}
              />
            </label>
            <div className="preview-pane">
              <h3>미리보기</h3>
              <div className="preview-rendered" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>

          <div className="row end">
            {draft.id && (
              <button
                className="danger"
                onClick={() => deletePostMutation.mutate(draft.id as string)}
                disabled={deletePostMutation.isPending}
              >
                삭제
              </button>
            )}
            <button
              onClick={onSavePost}
              disabled={
                !draft.title.trim() ||
                !composedMarkdown.trim() ||
                createPostMutation.isPending ||
                updatePostMutation.isPending
              }
            >
              {createPostMutation.isPending || updatePostMutation.isPending
                ? "저장 중..."
                : "게시글 저장"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export const Route = createFileRoute("/")({
  component: DashboardPage,
});
