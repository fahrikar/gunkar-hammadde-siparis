#!/bin/bash
# Claude Code on the web oturumlarında test araçlarını hazırlar.
# Uygulamanın kendisi bağımlılıksızdır; buradaki kurulum sadece
# `npm run check` ve `npm test` içindir.
set -euo pipefail

# Yerel makinede çalışmaz; geliştirici kendi ortamını yönetsin.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# playwright-core tarayıcı indirmez; Chromium ortamda hazır geliyor.
npm install --no-audit --no-fund
