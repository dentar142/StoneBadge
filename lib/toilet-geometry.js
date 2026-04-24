/**
 * 程序化马桶几何体（替代 seatstone.glb）
 * 用 Three.js 原生 primitives 拼出一个识别度足够的马桶轮廓：
 *   - tank   水箱（背后的方盒）
 *   - lid    水箱盖（顶上略宽的扁盒）
 *   - button 冲水按钮（盖上的小圆柱）
 *   - bowl   碗体（前面的椭圆筒）
 *   - rim    碗口（环面）
 *   - seat   坐垫（更细的环面贴在 rim 之上）
 *   - foot   底座（碗体下方更小的筒）
 * 输出 THREE.Group，可直接喂给 template-generator 渲染管线。
 */
export function buildToilet(THREE) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });

  // -- 碗体（椭圆筒：CylinderGeometry + 非等比缩放） --
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.45, 0.5, 28, 1, false),
    mat
  );
  bowl.scale.set(1.0, 1.0, 0.78);
  bowl.position.set(0, -0.05, 0.18);
  group.add(bowl);

  // -- 碗口环 --
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.075, 14, 36),
    mat
  );
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1.0, 1.0, 0.78);
  rim.position.set(0, 0.20, 0.18);
  group.add(rim);

  // -- 坐垫环（贴在 rim 之上稍偏前） --
  const seat = new THREE.Mesh(
    new THREE.TorusGeometry(0.50, 0.045, 10, 32),
    mat
  );
  seat.rotation.x = Math.PI / 2;
  seat.scale.set(1.0, 1.0, 0.78);
  seat.position.set(0, 0.27, 0.18);
  group.add(seat);

  // -- 底座（更窄的筒） --
  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.30, 0.55, 18),
    mat
  );
  foot.position.set(0, -0.58, 0.18);
  group.add(foot);

  // -- 水箱（背后方盒） --
  const tank = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.92, 0.36),
    mat
  );
  tank.position.set(0, 0.46, -0.36);
  group.add(tank);

  // -- 水箱盖（顶上略宽的扁盒） --
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.02, 0.08, 0.42),
    mat
  );
  lid.position.set(0, 0.96, -0.36);
  group.add(lid);

  // -- 冲水按钮（盖上偏前的小圆柱） --
  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16),
    mat
  );
  button.position.set(0.18, 1.025, -0.30);
  group.add(button);

  // 渲染管线只看 face 的世界坐标 + 法线，确保所有 mesh 有 normal
  group.traverse((child) => {
    if (child.isMesh && !child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }
  });

  return group;
}
