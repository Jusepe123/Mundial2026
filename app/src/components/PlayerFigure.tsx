import { useMemo } from "react"
import Svg, { Circle, Rect, Defs, Pattern, Text as SvgText, G } from "react-native-svg"
import type { JerseyConfig } from "../lib/jersey-colors"

interface PlayerFigureProps {
    size?: number
    config: JerseyConfig
    number?: number | null
}

export default function PlayerFigure({ size = 36, config, number }: PlayerFigureProps) {
    const scale = size / 40

    const headR = 7 * scale
    const torsoW = 24 * scale
    const torsoH = 18 * scale
    const torsoX = (size - torsoW) / 2
    const torsoY = headR * 2 + 2 * scale
    const fontSize = 8 * scale

    const fill = useMemo(() => {
        if (config.pattern === "stripes") return "url(#stripes)"
        if (config.pattern === "checkered") return "url(#checkered)"
        return config.primary
    }, [config])

    return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Defs>
                {config.pattern === "stripes" && (
                    <Pattern id="stripes" width={6 * scale} height={6 * scale} patternUnits="userSpaceOnUse">
                        <Rect width={3 * scale} height={6 * scale} fill={config.primary} />
                        <Rect x={3 * scale} width={3 * scale} height={6 * scale} fill={config.secondary} />
                    </Pattern>
                )}
                {config.pattern === "checkered" && (
                    <Pattern id="checkered" width={6 * scale} height={6 * scale} patternUnits="userSpaceOnUse">
                        <Rect width={3 * scale} height={3 * scale} fill={config.primary} />
                        <Rect x={3 * scale} y={3 * scale} width={3 * scale} height={3 * scale} fill={config.primary} />
                        <Rect x={3 * scale} width={3 * scale} height={3 * scale} fill={config.secondary} />
                        <Rect y={3 * scale} width={3 * scale} height={3 * scale} fill={config.secondary} />
                    </Pattern>
                )}
            </Defs>

            <G>
                <Circle cx={size / 2} cy={headR + 1 * scale} r={headR} fill="#D4D4D4" />

                <Rect x={torsoX} y={torsoY} width={torsoW} height={torsoH} rx={4 * scale} fill={fill} />

                {number != null && (
                    <SvgText
                        x={size / 2}
                        y={torsoY + torsoH / 2 + fontSize * 0.35}
                        textAnchor="middle"
                        fontSize={fontSize}
                        fontWeight="bold"
                        fill={config.numberColor}
                    >
                        {number}
                    </SvgText>
                )}
            </G>
        </Svg>
    )
}
