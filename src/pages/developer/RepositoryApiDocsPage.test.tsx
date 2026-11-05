import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../config/axios", () => ({ default: { post: mocks.post } }));

import RepositoryApiDocsPage from "./RepositoryApiDocsPage";

const document = {
  openapi: "3.0.3",
  info: { title: "Research Repository API", description: "Public integration docs", version: "1.0.0" },
  tags: [{ name: "Works", description: "Search repository works" }],
  paths: {
    "/public/v1/repository/works": {
      get: { tags: ["Works"], summary: "Search works", description: "Find public works", responses: { "200": { description: "Success" } } },
    },
  },
};
const renderPage = (isAuthenticated: boolean) => {
  const store = configureStore({ reducer: { auth: (state = { isAuthenticated }) => state } });
  return render(<Provider store={store}><MemoryRouter><RepositoryApiDocsPage /></MemoryRouter></Provider>);
};

describe("public Repository API docs", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => document }));
    mocks.post.mockReset();
  });

  it("shows public guides and endpoint reference without requiring sign-in", async () => {
    renderPage(false);
    expect(await screen.findByText("Public developer docs")).toBeTruthy();
    expect(screen.getByText("Cursor pagination")).toBeTruthy();
    expect(screen.getByText("JavaScript / TypeScript · Node.js 18+")).toBeTruthy();
    expect(screen.getByText("Python · requests")).toBeTruthy();
    expect(screen.getByText("Search repository works")).toBeTruthy();
    expect(screen.getByRole("button", { name: /sign in to create a key/i })).toBeTruthy();
  });

  it("lets a signed-in user create a key from the docs and shows its one-time secret", async () => {
    mocks.post.mockResolvedValue({ data: { data: { key: { displayName: "Research client", scopes: ["repository:read"] }, secret: "one-time-secret-value" } } });
    renderPage(true);
    await screen.findByText("Public developer docs");
    fireEvent.click(screen.getByRole("button", { name: /create api key here/i }));
    fireEvent.change(screen.getByLabelText("Key name"), { target: { value: "Research client" } });
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    expect(await screen.findByText("one-time-secret-value")).toBeTruthy();
    expect(mocks.post).toHaveBeenCalledWith("/me/repository-api-keys", { displayName: "Research client", scopes: ["repository:read", "project:read", "analysis:read"] });
    await waitFor(() => expect((screen.getByLabelText("API key for Try it out") as HTMLInputElement).value).toBe("one-time-secret-value"));
  });
});
