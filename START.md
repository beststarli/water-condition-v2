# 全局
```bash
安装依赖
pnpm i 
```
复制data文件夹至根目录下

# 后端
进入/package/server配置数据库

```bash
pnpm dlx prisma init
pnpm prisma db pull
pnpm prisma generate
```

在/package/server/src/config/env.ts中修改PORT和DATA_FOLDER_PATH的值

# 启动命令
在根目录下
```bash
# 启动前端
pnpm run dev:client
# 启动后端
pnpm run dev:server
```