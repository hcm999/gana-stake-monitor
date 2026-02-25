# GANA 质押数据监控系统

## 项目结构
- `public/index.html` - 公开展示页面（只读）
- `public/admin.html` - 管理员后台（需要密码）
- `data/` - 数据存储目录
- `scripts/` - 自动更新脚本

## 部署步骤

### 1. Fork 这个仓库
点击右上角的 Fork 按钮

### 2. 配置管理员密码
在 `public/admin.html` 中修改：
```javascript
const ADMIN_PASSWORD = "你的管理员密码";
