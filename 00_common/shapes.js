function shapeF() {
    let arrays = {
        a_position: { numComponents: 2, data: [
            0, 0, 0, 200, 40, 200, 40, 0, 40, 40, 200, 40, 200, 0, 40, 120, 150, 120, 150, 80, 40, 80,
        ]},
        indices: { numComponents: 3, data: [
            0, 1, 2, 2, 3, 0, 3, 4, 5, 5, 6, 3, 7, 8, 9, 9, 10, 7,
        ]}
    };
    return arrays;
}

function loadWheel(wheelData) {
    return {
        a_position: wheelData.a_position,
        a_normal: wheelData.a_normal,
        a_color: wheelData.a_color,
        indices: {
            numComponents: 3,
            data: Array.from({ length: wheelData.a_position.data.length / 9 }, (_, i) => [
                i * 3, i * 3 + 1, i * 3 + 2
            ]).flat()
        }
    };
}

export { shapeF, loadWheel };