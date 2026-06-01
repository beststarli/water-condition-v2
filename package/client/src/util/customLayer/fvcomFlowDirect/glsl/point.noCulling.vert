#version 300 es
precision highp float;

// 输入变量，表示粒子是否存活
layout (location = 0) in float isAlive;

// 流场的全局Uniform变量
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

// 纹理和其他Uniform变量
uniform sampler2D particlePool;       // 粒子池纹理，存储粒子数据
uniform sampler2D projectionTexture;  // 投影纹理，用于坐标转换
uniform int blockNum;                 // 粒子块数量
uniform int beginBlock;               // 起始块索引
uniform int blockSize;                // 每块的大小
uniform float currentSegmentNum;      // 当前段数
uniform float fillWidth;              // 填充宽度，用于抗锯齿计算
uniform float aaWidth;                // 抗锯齿宽度
uniform vec2 viewport;                // 视口尺寸
uniform mat4 u_matrix;                // 投影矩阵

// 输出结构体，包含流线设置的相关参数
out struct Stream_line_setting 
{
    float edgeParam;       // 边缘参数，用于抗锯齿计算
    float alphaDegree;     // 透明度因子
    float velocity;        // 速度百分比，用于颜色映射
    float isDiscarded;     // 是否丢弃片元的标志
    vec2 uv;               // UV坐标，用于片元位置计算
} sls;

// 定义四个顶点的屏幕偏移量
vec2 box[4] = vec2[](
    vec2(0.0, 0.0),
    vec2(0.0, 1.0),
    vec2(1.0, 0.0),
    vec2(1.0, 1.0)
);

// 定义四个顶点的UV坐标
vec2 uvs[4] = vec2[](
    vec2(-1.0, -1.0),
    vec2(-1.0, 1.0),
    vec2(1.0, -1.0),
    vec2(1.0, 1.0)
);

// 坐标转换函数，将粒子位置转换为裁剪空间坐标
vec4 ReCoordinate(vec2 pos) {

    vec3 geoPos;
    geoPos = texture(projectionTexture, pos).xyz; // 从投影纹理中获取地理坐标
    vec4 res = u_matrix * vec4(geoPos, 1.0);      // 应用投影矩阵
    return res;
}

// 计算当前顶点的UV坐标
ivec2 get_uv(int vertexIndex)
{
    int blockIndex = (beginBlock - vertexIndex + blockNum) % blockNum; // 计算当前顶点所属的块索引

    int textureWidth = textureSize(particlePool, 0).x; // 获取粒子池纹理的宽度
    int columnNum = textureWidth / blockSize;          // 计算列数
    ivec2 blockUV = ivec2(blockIndex % columnNum, blockIndex / columnNum) * blockSize; // 计算块的UV坐标

    ivec2 vertexUV = blockUV + ivec2(gl_InstanceID % blockSize, gl_InstanceID / blockSize); // 计算顶点的UV坐标

    return vertexUV;
}

// 将粒子位置转换为裁剪空间坐标
vec4 transfer_to_clip_space(vec2 pos)
{
    return ReCoordinate(pos);
}

// 获取粒子的裁剪空间位置
vec4 get_clip_position(ivec2 uv)
{
    return transfer_to_clip_space(texelFetch(particlePool, uv, 0).rg); // 从粒子池中获取位置数据
}

// 计算两个顶点之间的方向向量
vec2 get_vector(vec2 beginVertex, vec2 endVertex)
{
    return normalize(endVertex - beginVertex); // 归一化方向向量
}

void main()
{
    // 获取当前顶点的屏幕位置
    int currentVertex = 0;
    ivec2 c_uv = get_uv(currentVertex);
    vec4 cv_pos_CS = get_clip_position(c_uv);
    vec2 cv_pos_SS = cv_pos_CS.xy / cv_pos_CS.w; // 转换为屏幕空间坐标

    // 计算屏幕偏移量
    float speedRate = texelFetch(particlePool, c_uv, 0).b; // 从粒子池中获取速度百分比
    float r = (fillWidth + aaWidth * 2.0); // 计算填充宽度和抗锯齿宽度
    float screenOffset = r / 2.0;

    // 平移当前顶点位置
    vec2 v_offset = screenOffset * box[gl_VertexID];
    vec2 vertexPos_SS = cv_pos_SS + v_offset / viewport;

    // 计算顶点的屏幕坐标
    vec2 vertexPos_CS = vertexPos_SS * cv_pos_CS.w;
    gl_Position = vec4(vertexPos_CS, 0.0, cv_pos_CS.w); // 设置顶点的裁剪空间位置

    // 准备抗锯齿参数
    float segmentRate = float(currentVertex) / currentSegmentNum; // 计算段数比例
    sls.alphaDegree = 1.0 - segmentRate; // 设置透明度因子

    sls.velocity = speedRate; // 设置速度百分比
    sls.uv = uvs[gl_VertexID]; // 设置UV坐标
    sls.isDiscarded = isAlive; // 设置是否丢弃片元的标志
}