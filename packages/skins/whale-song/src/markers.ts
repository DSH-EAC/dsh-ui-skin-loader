/**
 * 被迁移上游皮肤的自有标记（唯一事实来源；session 的清扫与测试共同引用）。
 *
 * 这些标记是**上游皮肤自己的**命名空间（随观感内容原样迁移）：body 激活标记
 * data-dsh-whale-song、style 节点的 data-plugin-css/data-plugin 标记。它们与
 * 加载器保留面（usl- / dsh-ui-skin-loader）和其它皮肤互不重叠（公约 R2/R3）；
 * 宿主主题标记 data-ds-dark-theme 是 aurora 先例明示容忍的唯一宿主属性
 * （本皮肤的亮暗遮罩切换正建立在它之上，随观感内容原样迁移）。
 */

/** 上游包名（style 节点 data-plugin 标记的值；§4.3 清扫按它定位本皮肤自产节点）。 */
export const UPSTREAM_PACKAGE = "@linxin666/dsh-client-ui-skin-whale-song";

/** 上游 body 激活标记（残留断言锚点：deactivate 后必须归零）。 */
export const ACTIVE_BODY_MARKER = "data-dsh-whale-song";

/** 上游 style 节点的 data-plugin-css 值（去重键）。 */
export const UPSTREAM_STYLE_TAG_ID = `${UPSTREAM_PACKAGE}/whale-song.module.css`;
