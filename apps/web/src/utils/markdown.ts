import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

const stripHtmlTags = (value: string) => value.replace(/<[^>]*>/g, " ");

export const renderMarkdown = (value: string) => markdown.render(value);

export const markdownToPlainText = (value: string) =>
  stripHtmlTags(markdown.render(value))
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
