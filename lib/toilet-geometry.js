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

  // -- 碗体（一根从碗口直通地面的椎体，省掉单独的 foot 件以消除"圆台"分段） --
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.28, 1.05, 28, 1, false),
    mat
  );
  bowl.scale.set(1.0, 1.0, 0.78);
  bowl.position.set(0, -0.33, 0.18);
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

  // -- 碗内水面 disk（堵住空心碗内壁，消除穿透感） --
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.02, 28),
    mat
  );
  water.scale.set(1.0, 1.0, 0.78);
  water.position.set(0, 0.13, 0.18);
  group.add(water);

  // -- 水箱（更厚更矮，比例更接近真实马桶） --
  const tank = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.78, 0.45),
    mat
  );
  tank.position.set(0, 0.39, -0.40);
  group.add(tank);

  // -- 水箱盖（顶上略宽的扁盒） --
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.02, 0.08, 0.50),
    mat
  );
  lid.position.set(0, 0.82, -0.40);
  group.add(lid);

  // -- 冲水按钮（盖上偏前的小圆柱） --
  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16),
    mat
  );
  button.position.set(0.18, 0.885, -0.34);
  group.add(button);

  // 渲染管线只看 face 的世界坐标 + 法线，确保所有 mesh 有 normal
  group.traverse((child) => {
    if (child.isMesh && !child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }
  });

  return group;
}
