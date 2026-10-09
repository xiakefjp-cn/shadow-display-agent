# Shadow Display Agent

Android 原型：用户持续使用物理主屏（Display 0），Agent 在同一台手机的虚拟显示中完成真实任务。主屏只读，任何点击、滑动和输入都在代码层强制绑定非零 `displayId`。

![Android 虚拟显示智能体技术架构](./shadow-display-agent-architecture.visual-check.1440x900.light.png)

- [完整项目报告](./Android虚拟显示智能体系统设计与实现报告.md)
- [交互式技术架构图](./shadow-display-agent-architecture.html)

## 能力与安全边界

- 不同 App：用户在主屏使用任意 App，Agent 在 scrcpy 虚拟显示操作目标 App。
- 同一 App：`demo-app` 构建 `user`/`agent` 两个独立包，共享同一后端数据，避免任务栈和本地状态冲突。
- 主屏观察默认只读取前台焦点；只有同时设置 `ALLOW_MAIN_DISPLAY_CAPTURE=true` 且前台包名位于 `HUMAN_OBSERVER_ALLOW_PACKAGES` 白名单时，才会截取主屏并通过独立模型调用转换成只读语义上下文。
- 虚拟显示强制使用本地 IME 策略、关闭剪贴板同步；策略层拒绝一切发往 Display 0 的写操作。
- 模型声明完成不算成功；任务必须通过独立 API/文件验证器。
- 支付、删除、发送、发布及账号变更不在自动执行范围内。

## 部署（Windows + Android 10+）

前置：Node.js 20+、一台开启 USB 调试的 Android；构建双实例 Demo 还需 Android Studio/SDK 35 和 Gradle。

```powershell
# 1. 安装官方 scrcpy Windows 包（内含 adb），并生成 .env
powershell -ExecutionPolicy Bypass -File .\scripts\install-android-tools.ps1

# 2. USB 连接并授权手机；检查虚拟显示、定向输入和隔离选项
npm test
npm run doctor

# 3. 构建并安装同 App 双实例
powershell -ExecutionPolicy Bypass -File .\scripts\build-demo-app.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\install-demo-apps.ps1

# 4. 复制配置；安装脚本已通过 adb reverse 将手机 8787 映射到电脑
Copy-Item .\config\apps.example.json .\config\apps.json
Start-Process node -ArgumentList 'demo-server/server.mjs' -WindowStyle Hidden

# 5. 启动 AutoGLM OpenAI-compatible 服务后执行成功案例
node .\src\cli.mjs run --title "Prepare interview notes"
```

演示：在物理屏打开 `Shadow Tasks`（或任意其他 App）并持续滑动/打字；Agent 在不可见的虚拟显示打开 `Shadow Tasks Agent` 创建标题为 `Prepare interview notes` 的任务。Agent 返回完成后，物理屏刷新列表即可看到同一后端的真实记录。

`Prepare111` 字符顺序异常和中文输入乱码作为 Bad Case 保留在项目报告中，不作为成功案例。

## 环境变量

| 变量 | 说明 |
|---|---|
| `ADB_PATH` / `SCRCPY_PATH` | Android工具路径 |
| `ANDROID_SERIAL` | 多设备时指定序列号 |
| `AGENT_DISPLAY_SIZE` / `AGENT_DISPLAY_DPI` | Agent虚拟显示参数 |
| `PHONE_AGENT_BASE_URL` / `PHONE_AGENT_API_KEY` / `PHONE_AGENT_MODEL` | AutoGLM兼容接口 |
| `PHONE_AGENT_MAX_STEPS` | 任务最大步数 |
| `ALLOW_MAIN_DISPLAY_CAPTURE` | 是否允许保存用户主屏截图，默认关闭 |
| `HUMAN_OBSERVER_ALLOW_PACKAGES` | 允许观察的主屏包名白名单 |
| `DEMO_API_URL` / `DEMO_API_TOKEN` | 独立结果验证服务 |

运行证据写入 `.shadow-agent/run-*/events.jsonl` 和 Agent屏幕截图。已知限制：部分厂商ROM或 App 不允许辅助显示；通用ADB文本输入仅保证 ASCII；生产环境需要专用IME/无障碍输入适配器。虚拟显示隔离画面和输入，但不自动产生第二个 App 数据目录，因此同 App 必须使用分身、工作资料、双包名或 API 通道。
