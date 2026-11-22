"""N-body, written by hand in idiomatic Python (the same program as ../nbody.nuc)."""
import math


class Body:
    __slots__ = ("x", "y", "z", "vx", "vy", "vz", "mass")

    def __init__(self, x: float, y: float, z: float, vx: float, vy: float, vz: float, mass: float) -> None:
        self.x, self.y, self.z = x, y, z
        self.vx, self.vy, self.vz = vx, vy, vz
        self.mass = mass


def energy(bodies: list[Body]) -> float:
    e = 0.0
    for i, b in enumerate(bodies):
        e += 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy + b.vz * b.vz)
        for c in bodies[i + 1:]:
            dx = b.x - c.x
            dy = b.y - c.y
            dz = b.z - c.z
            e -= b.mass * c.mass / math.sqrt(dx * dx + dy * dy + dz * dz)
    return e


def advance(bodies: list[Body], dt: float) -> None:
    n = len(bodies)
    for i in range(n):
        b = bodies[i]
        for j in range(i + 1, n):
            c = bodies[j]
            dx = b.x - c.x
            dy = b.y - c.y
            dz = b.z - c.z
            d2 = dx * dx + dy * dy + dz * dz
            mag = dt / (d2 * math.sqrt(d2))
            b.vx -= dx * c.mass * mag
            b.vy -= dy * c.mass * mag
            b.vz -= dz * c.mass * mag
            c.vx += dx * b.mass * mag
            c.vy += dy * b.mass * mag
            c.vz += dz * b.mass * mag
    for b in bodies:
        b.x += dt * b.vx
        b.y += dt * b.vy
        b.z += dt * b.vz


def main() -> None:
    bodies = [
        Body(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 39.47841760435743),
        Body(4.84143144246472090, -1.16032004402742839, -0.103622044471123109, 0.606326392995832, 2.81198684491626, -0.02521836165988763, 0.03769367487038949),
        Body(8.34336671824457987, 4.12479856412430479, -0.403523417114321381, -1.0107743461787924, 1.8256623712304119, 0.008415761376584154, 0.011286326131968767),
        Body(12.8943695621391310, -15.1111514016986312, -0.223307578892655734, 1.0827910064415354, 0.8687130181696082, -0.010832637401363636, 0.0017237240570597112),
        Body(15.3796971148509165, -25.9193146099879641, 0.179258772950371181, 0.979090732243898, 0.5946989986476762, -0.034755955504078104, 0.0020336868699246304),
    ]
    print(f"{energy(bodies):.9f}")
    for _ in range(200000):
        advance(bodies, 0.01)
    print(f"{energy(bodies):.9f}")


main()
