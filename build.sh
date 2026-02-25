#!/bin/bash
# build.sh - 在部署时生成 config.js

echo "正在生成配置文件..."
echo "window.APP_CONFIG = {" > public/config.js
echo "    GITHUB_TOKEN: '$GITHUB_TOKEN'" >> public/config.js
echo "};" >> public/config.js
echo "配置文件生成完成"
