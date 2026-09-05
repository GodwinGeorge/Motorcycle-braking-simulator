#pragma once

#include <algorithm>
#include <cmath>

struct BrakingForces {
    double frontLoad;
    double rearLoad;
    double frontForce;
    double rearForce;
    bool rearWheelLift;
    bool absActive;
};

inline BrakingForces calculateBrakingForces(
    double mass,
    double brakeForce,
    double friction,
    double leanGrip,
    double frontBrakeBias,
    bool absEnabled,
    bool rearWheelLiftRequested,
    double acceleration,
    double cgHeight,
    double wheelbase
) {
    constexpr double GRAVITY = 9.81;
    const double requestedFront = brakeForce * frontBrakeBias / 100.0;
    const double requestedRear = brakeForce - requestedFront;
    double frontForce = 0.0;
    double rearForce = 0.0;
    double frontLoad = 0.5 * mass * GRAVITY;
    double rearLoad = frontLoad;
    bool absActive = false;

    for (int iteration = 0; iteration < 8; ++iteration) {
        const double deceleration = std::max(0.0, -acceleration);
        const double transfer = mass * deceleration * cgHeight / wheelbase;
        frontLoad = 0.5 * mass * GRAVITY + transfer;
        rearLoad = std::max(0.0, 0.5 * mass * GRAVITY - transfer);
        const double frontLimit = friction * leanGrip * frontLoad;
        const double rearLimit = friction * leanGrip * rearLoad;
        const double liftForce = mass * GRAVITY * wheelbase / (2.0 * cgHeight);
        const bool liftAttempt = rearWheelLiftRequested && !absEnabled;
        const double nextFront = liftAttempt
            ? std::min(frontLimit, std::max(requestedFront, liftForce))
            : std::min(requestedFront, absEnabled ? frontLimit : frontLimit * 0.7);
        const double nextRear = liftAttempt
            ? 0.0
            : std::min(requestedRear, absEnabled ? rearLimit : rearLimit * 0.7);
        absActive = absActive || (absEnabled && (nextFront < requestedFront || nextRear < requestedRear));
        frontForce = nextFront;
        rearForce = nextRear;
        acceleration = -(frontForce + rearForce) / mass;
    }

    return { frontLoad, rearLoad, frontForce, rearForce, rearLoad <= 1e-6 && rearWheelLiftRequested && !absEnabled, absActive };
}

class VehicleModel {
public:
    VehicleModel(double mass, double frictionCoefficient, double effectiveMass = 0.0);
    void setInitialVelocity(double velocity);
    void update(double dt, double brakeForce);

    double getVelocity() const;
    double getPosition() const;
    double getAcceleration() const;

private:
    double mass_;
    double frictionCoefficient_;
    double effectiveMass_;
    double velocity_;
    double position_;
    double acceleration_;
    static constexpr double GRAVITY = 9.81; // m/s^2
};