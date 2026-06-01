#version 300 es
precision highp float;

// 输入结构体，包含流线设置的相关参数
in struct Stream_line_setting 
{
    float edgeParam;       // 边缘参数，用于抗锯齿计算
    float alphaDegree;     // 透明度因子
    float velocity;        // 速度百分比，用于颜色映射
    float isDiscarded;     // 是否丢弃片元的标志
    vec2 uv;               // UV坐标，用于片元位置计算
} sls;

// 流场的全局Uniform变量：使用 std140 布局规则的 Uniform 块
/*
作用: 指定 Uniform 块的内存布局规则。
特点: std140 布局规则确保 Uniform 数据在 GPU 内存中以固定的对齐方式存储，便于跨平台一致性。
        标量（如 float）对齐到 4 字节。
        向量（如 vec4）对齐到 16 字节。
        数组的每个元素对齐到 16 字节。
*/
layout (std140) uniform FlowFieldUniforms
{
    float progress;        // 流场的进度，用于动画控制
    float segmentNum;      // 流线的段数，用于丢弃逻辑
    float fullLife;        // 粒子的生命周期
    float dropRate;        // 粒子掉落率
    float dropRateBump;    // 粒子掉落率的增量
    float speedFactor;     // 速度因子，用于流场速度调整
    float colorScheme;     // 颜色方案选择
    vec4 flowBoundary;     // 流场边界
};
uniform float fillWidth;  // 填充宽度，用于抗锯齿计算
uniform float aaWidth;    // 抗锯齿宽度

out vec4 fragColor;       // 输出的片元颜色

// 定义颜色映射表（方案0）
int rampColors0[8] = int[](
    0x3288bd,  // 蓝色
    0x66c2a5,  // 青绿色
    0xabdda4,  // 浅绿色
    0xe6f598,  // 黄色
    0xfee08b,  // 浅橙色
    0xfdae61,  // 橙色
    0xf46d43,  // 红色
    0xd53e4f   // 深红色
);

// 定义颜色映射表（方案1）
int rampColors1[8] = int[](
    0x8c510a,  // 棕色
    0xbf812d,  // 浅棕色
    0xdfc27d,  // 米色
    0xf6e8c3,  // 浅米色
    0xc7eae5,  // 浅蓝色
    0x80cdc1,  // 蓝绿色
    0x35978f,  // 深蓝绿色
    0x01665e   // 深绿色
);

// 定义颜色映射表（方案2）
int rampColors2[8] = int[](
    0x8dd3c7,  // 浅蓝绿色
    0xffffb3,  // 黄色
    0xbebada,  // 紫色
    0xfb8072,  // 浅红色
    0x80b1d3,  // 蓝色
    0xfdb462,  // 橙色
    0xb3de69,  // 浅绿色
    0xfccde5   // 粉色
);

// 根据颜色方案选择颜色映射表
int[8] rampColors()
{
    if (colorScheme == 0.0)
        return rampColors0;
    if (colorScheme == 1.0)
        return rampColors1;
    if (colorScheme == 2.0)
        return rampColors2;
} 

// 从整数颜色值中提取RGB颜色
vec3 colorFromInt(int color)
{
    float b = float(color & 0xFF) / 255.0;          // 提取蓝色分量
    float g = float((color >> 8) & 0xFF) / 255.0;   // 提取绿色分量
    float r = float((color >> 16) & 0xFF) / 255.0;  // 提取红色分量

    return vec3(r, g, b);
}

// 根据速度计算颜色
vec3 velocityColor(float speed)
{
    float bottomIndex = floor(speed * 10.0);        // 计算底部索引
    float topIndex = mix(bottomIndex + 1.0, 7.0, step(6.0, bottomIndex)); // 计算顶部索引
    float interval = mix(1.0, 4.0, step(6.0, bottomIndex)); // 插值区间

    vec3 slowColor = colorFromInt(rampColors()[int(bottomIndex)]); // 慢速颜色
    vec3 fastColor = colorFromInt(rampColors()[int(topIndex)]);   // 快速颜色

    return mix(slowColor, fastColor, (speed * 10.0 - float(bottomIndex)) / interval); // 插值计算颜色
}

// 计算抗锯齿透明度
float getAlpha(float param)
{
    if (aaWidth == 0.0) return 1.0; // 如果抗锯齿宽度为0，直接返回完全透明
    float alpha = 1.0 - sin(clamp((param * (0.5 * fillWidth + aaWidth) - 0.5 * fillWidth) / aaWidth, 0.0, 1.0) * 2.0 / 3.141592653);
    return alpha;
}

void main() 
{
    // 如果片元被丢弃，直接退出
    if (sls.isDiscarded >= segmentNum * 9.0) discard; 

    // 计算透明度
    float alpha = getAlpha(abs(sls.edgeParam));
    float aaDegree = fillWidth / (aaWidth + fillWidth);
    if (length(sls.uv) <= aaDegree) {
        alpha = 1.0;
    }
    else
        alpha = 1.0 - length(sls.uv);

    // 根据速度计算颜色
    vec3 color = velocityColor(sls.velocity);

    // 输出片元颜色
    fragColor = vec4(color, 1.0) * alpha;
}