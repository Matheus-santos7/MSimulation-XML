import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authSurfaceClass,
  panelHeaderClass,
  panelSurfaceClass,
  shellNavLinkClass,
  shellNavSectionLabelClass,
} from "./shell-styles.js";

describe("shellNavLinkClass", () => {
  it("marca item ativo com fundo suave e texto accent", () => {
    const cls = shellNavLinkClass(true);
    assert.match(cls, /bg-accent\/10/);
    assert.match(cls, /text-accent/);
    assert.match(cls, /rounded-lg/);
  });

  it("item inativo usa muted e hover suave", () => {
    const cls = shellNavLinkClass(false);
    assert.match(cls, /text-muted-foreground/);
    assert.match(cls, /hover:bg-muted\/70/);
    assert.doesNotMatch(cls, /bg-accent\/10/);
  });
});

describe("shellNavSectionLabelClass", () => {
  it("usa tipografia discreta de seção SaaS", () => {
    const cls = shellNavSectionLabelClass();
    assert.match(cls, /uppercase/);
    assert.match(cls, /tracking-wider/);
    assert.match(cls, /text-muted-foreground/);
  });
});

describe("authSurfaceClass", () => {
  it("define card de auth com mais ar e sombra suave", () => {
    const cls = authSurfaceClass();
    assert.match(cls, /rounded-2xl/);
    assert.match(cls, /bg-card/);
    assert.match(cls, /shadow-/);
    assert.match(cls, /p-8|p-10/);
  });
});

describe("panelSurfaceClass", () => {
  it("define painel de dashboard com cantos suaves", () => {
    const cls = panelSurfaceClass();
    assert.match(cls, /rounded-2xl/);
    assert.match(cls, /bg-card/);
    assert.match(cls, /overflow-hidden/);
  });
});

describe("panelHeaderClass", () => {
  it("espaça cabeçalho de painel com borda suave", () => {
    const cls = panelHeaderClass();
    assert.match(cls, /px-4/);
    assert.match(cls, /border-b/);
  });
});
