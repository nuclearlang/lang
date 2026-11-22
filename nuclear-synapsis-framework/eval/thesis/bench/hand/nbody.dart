// N-body, written by hand in idiomatic Dart (the same program as ../nbody.nuc).
import 'dart:math';

class Body {
  double x, y, z, vx, vy, vz;
  final double mass;
  Body(this.x, this.y, this.z, this.vx, this.vy, this.vz, this.mass);
}

double energy(List<Body> bodies) {
  var e = 0.0;
  for (var i = 0; i < bodies.length; i++) {
    final b = bodies[i];
    e += 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
    for (var j = i + 1; j < bodies.length; j++) {
      final c = bodies[j];
      final dx = b.x - c.x;
      final dy = b.y - c.y;
      final dz = b.z - c.z;
      e -= b.mass * c.mass / sqrt(dx * dx + dy * dy + dz * dz);
    }
  }
  return e;
}

void advance(List<Body> bodies, double dt) {
  final n = bodies.length;
  for (var i = 0; i < n; i++) {
    final b = bodies[i];
    for (var j = i + 1; j < n; j++) {
      final c = bodies[j];
      final dx = b.x - c.x;
      final dy = b.y - c.y;
      final dz = b.z - c.z;
      final d2 = dx * dx + dy * dy + dz * dz;
      final mag = dt / (d2 * sqrt(d2));
      b.vx -= dx * c.mass * mag;
      b.vy -= dy * c.mass * mag;
      b.vz -= dz * c.mass * mag;
      c.vx += dx * b.mass * mag;
      c.vy += dy * b.mass * mag;
      c.vz += dz * b.mass * mag;
    }
  }
  for (final b in bodies) {
    b.x += dt * b.vx;
    b.y += dt * b.vy;
    b.z += dt * b.vz;
  }
}

void main() {
  final bodies = [
    Body(0, 0, 0, 0, 0, 0, 39.47841760435743),
    Body(4.84143144246472090, -1.16032004402742839, -0.103622044471123109, 0.606326392995832, 2.81198684491626, -0.02521836165988763, 0.03769367487038949),
    Body(8.34336671824457987, 4.12479856412430479, -0.403523417114321381, -1.0107743461787924, 1.8256623712304119, 0.008415761376584154, 0.011286326131968767),
    Body(12.8943695621391310, -15.1111514016986312, -0.223307578892655734, 1.0827910064415354, 0.8687130181696082, -0.010832637401363636, 0.0017237240570597112),
    Body(15.3796971148509165, -25.9193146099879641, 0.179258772950371181, 0.979090732243898, 0.5946989986476762, -0.034755955504078104, 0.0020336868699246304),
  ];
  print(energy(bodies).toStringAsFixed(9));
  for (var step = 0; step < 200000; step++) {
    advance(bodies, 0.01);
  }
  print(energy(bodies).toStringAsFixed(9));
}
