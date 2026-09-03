#pragma once

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