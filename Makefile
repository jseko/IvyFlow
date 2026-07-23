# Makefile for ivyflow-cli
# 集成：依赖安装、构建、质量门禁、测试、二进制打包、npm 发布、GitHub Release、文档。
# 查看全部目标与说明： make help
# 直接构建：            make build
# 发布到 npm：         make publish   （需先 `npm login` 为 jigeyin）
# 发布二进制 Release：  make release    （构建 + 多平台二进制 + git tag + gh release）

SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail

# 当前版本（取自 package.json）
VERSION := $(shell node -p "require('./package.json').version")

.PHONY: help install build dev rebuild clean \
        sync-phases sync-phases-check check-manifest check-skill-blocks \
        check-suggest-redlines check lint lint-fix test test-coverage \
        test-watch ci pack pack-dry binary binary-skip-compile \
        publish tag release docs docs-dev docs-preview

.DEFAULT_GOAL := help

help: ## 显示本帮助
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'

# ---------- 依赖与构建 ----------
install: ## 安装依赖 (npm install)
	npm install

build: ## 完整构建 (node build.js: 同步阶段 → 校验 → tsc)
	npm run build

dev: ## 监听模式编译 (tsc --watch)
	npm run dev

rebuild: clean build ## 清理后重新构建

clean: ## 删除 dist / bin-out / coverage / *.tgz
	rm -rf dist bin-out coverage
	rm -f *.tgz

# ---------- 质量门禁 (9 步工作流校验) ----------
sync-phases: ## 将阶段列表同步到规则文件
	npm run sync-phases

sync-phases-check: ## 校验阶段列表与规则文件是否一致
	npm run sync-phases:check

check-manifest: ## 校验 manifest.json schema
	npm run check-manifest

check-skill-blocks: ## 校验全部 SKILL.md 结构
	npm run check-skill-blocks

check-suggest-redlines: ## 校验 suggest 引擎红线约束
	npm run check-suggest-redlines

check: sync-phases-check check-manifest check-skill-blocks check-suggest-redlines lint ## 运行全部质量门禁（发布前必跑）

# ---------- 代码质量 ----------
lint: ## ESLint 检查
	npm run lint

lint-fix: ## ESLint 自动修复
	npm run lint:fix

# ---------- 测试 ----------
test: ## 运行测试 (vitest run)
	npm test

test-coverage: ## 测试覆盖率
	npm run test:coverage

test-watch: ## 监听模式测试
	npm run test:watch

ci: sync-phases-check check-manifest check-skill-blocks check-suggest-redlines lint test build ## CI 全流程

# ---------- 打包（二进制 + npm tarball） ----------
binary: ## 编译为多平台二进制（5 平台, 输出 bin-out/）
	npm run package:binary

binary-skip-compile: ## 跳过 tsc, 仅重新打包二进制
	npm run package:binary:skip-compile

pack: ## 生成 npm tarball 供检查 (npm pack)
	npm pack

pack-dry: ## 预览 tarball 内容 (npm pack --dry-run)
	npm pack --dry-run

# ---------- 发布 ----------
publish: ## 发布到 npm（自动先构建, 需先 `npm login` 为 jigeyin）
	npm publish

tag: ## 打当前版本 git tag: v$(VERSION)
	git tag -a v$(VERSION) -m "Release v$(VERSION)"

release: build binary tag ## 构建 + 二进制 + 打 tag + 创建 GitHub Release
	@echo "Creating GitHub release v$(VERSION)..."
	gh release create v$(VERSION) bin-out/* \
		--title "v$(VERSION)" \
		--generate-notes
	@echo "Done. Release v$(VERSION) created with bin-out/* assets."

# ---------- 文档 ----------
docs: ## 构建文档站点 (VitePress)
	npm run docs:build

docs-dev: ## 本地预览文档 (VitePress dev)
	npm run docs:dev

docs-preview: ## 预览已构建文档
	npm run docs:preview
