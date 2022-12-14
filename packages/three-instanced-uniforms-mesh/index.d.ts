declare module "three-instanced-uniforms-mesh" {
    import type { BufferGeometry, InstancedMesh, Vector2, Vector3, Vector4, Color, Matrix3, Matrix4, Quaternion } from "three";

    module "three-instanced-uniforms-mesh" {
        class InstancedUniformsMesh<
            T extends Material
            > extends InstancedMesh<BufferGeometry, T> {
            constructor(geometry: BufferGeometry, material: T, count: number);
            /**
             * Set the value of a shader uniform for a single instance.
             * @param {string} name - the name of the shader uniform
             * @param {number} index - the index of the instance to set the value for
             * @param {number|Vector2|Vector3|Vector4|Color|Array|Matrix3|Matrix4|Quaternion} value - the uniform value for this instance
             */
            setUniformAt(name: string, index: number, value: number | number[] | Vector2 | Vector3 | Vector4 | Color | Matrix3 | Matrix4 | Quaternion): void;
            /**
             * Unset all instance-specific values for a given uniform, reverting back to the original
             * uniform value for all.
             * @param {string} name
             */
            unsetUniform(name: string): void;
        }

        function createInstancedUniformsDerivedMaterial<T extends Material>(
            material: T
        ): T;
    }

}
