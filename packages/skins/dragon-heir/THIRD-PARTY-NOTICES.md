# Third-party notices — @dsh-eac/skin-dragon-heir「龙的传人」

本包的观感与行为内容迁移自第三方皮肤工程，按其许可随包落档。本包的**工程
骨架**（package.json 清单、公约接线、session 适配层、构建脚本、测试）是本仓
的原始代码；**观感内容**（CSS、背景画作、favicon、DOM 逻辑）来自下列上游。

## 上游来源（内容）

- 项目：dsh-web-ui（`@linxin666/dsh-client-ui-skin-dragon-heir`，version 0.1.11）
- 本包取材经：DSH-EAC/DSH-Desktop-EAC
  `dsh-desktop/assets/skins/dragon-heir/`（tree `ccbca1175f63686cfd8368dea49a51966bf14cd6`）
- 取材 commit：`26841f5ee83c154a9768cc0a9cec1d70078f0ddf`
  （规划 rev 一致；上游 main 当前已不含该目录，取材以该 rev 为准）
- 上游声明许可：BSD-3-Clause（随包附全文，见下；原文同时存于上游
  `dsh-desktop/assets/skins/dsh-skins-LICENSE.txt`）
- 上游版权声明：`Copyright (c) 2026, zhu1090093659`（BSD-3-Clause 第三条要求：
  本包不以上游名义背书）

## 本包改造说明（covenant-converted）

内容载体 `src/vendor/dsh-web-ui-client.js` = 上游 `lib/client.js` 的逐字节
迁移，唯一改动（公约化改造 S3，详见该文件头注释）：

1. 去除 DSH module-loader 打包外壳与 `exports.apply = apply` 粘合（上游打包
   机械，非皮肤内容）；
2. 模块顶层的 style 注入块移入 `apply()` 顶部（公约 R1：未激活零副作用）；
3. 追加 `export { apply };`（ESM 导出原入口）。

执行骨架（`src/client/session.ts`）为公约适配层：上游 apply 的全部副作用收进
activate，disposer 账本逆序幂等 teardown，并补齐上游没有的 style 节点清理
（公约 §4.3「退出后不可观测」）。

## 资产审查记录（IP 轻检）

逐项核对本包内嵌资产（client bundle 数据 URI 与预览图）：

- 两幅主题背景画（不屈龙魂 / 万里长城）：上游 art.ts 注释自述为
  gpt-image-2 生成的画作（AI 生成，皮肤作者委托生成），内容为水墨龙与长城
  风景——**无**可识别的第三方角色/商标/品牌素材；其中一幅含国旗元素（状态
  符号，非商业标志物）。
- 两枚龙印 favicon：上游自绘内联 SVG（朱砂/鎏金印章 + 「龙」字），非第三方
  素材。

未发现第三方商标/角色/品牌素材。风险备注：两幅画作 upstream 仅以注释声明
"generated"，无更细的权属凭证——如 controller 需要更强保证，可要求上游补充
生成记录后复核。

## BSD 3-Clause License（上游原文）

BSD 3-Clause License

Copyright (c) 2026, zhu1090093659
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
