#include "vehicleModel.hpp"
#include <algorithm>


VehicleModel::VehicleModel(double mass, double frictionCoefficient, double effectiveMass)
    : mass_(mass),
      frictionCoefficient_(frictionCoefficient),
    effectiveMass_(effectiveMass > 0.0 ? effectiveMass : mass),
      velocity_(0.0),
      position_(0.0),
      acceleration_(0.0)
{
}

void VehicleModel::setInitialVelocity(double velocity) {
    velocity_ = velocity;
}

void VehicleModel::update(double dt, double brakeForce){
    // Maximum braking force that tyre-road can provide
    const double maximumBrakeForce = frictionCoefficient_ * mass_ * GRAVITY; // F = μ * m * g

    // Calculate the actual braking force applied, ensuring it does not exceed the maximum braking force
    const double actualBrakeForce = std::min(brakeForce, maximumBrakeForce);

    // F = ma -> a = F/m
    acceleration_ = -actualBrakeForce / effectiveMass_; // Includes wheel rotational inertia

    // position update using constant acceleration over this time step
    position_ += velocity_ * dt + 0.5 * acceleration_ * dt * dt;

    // velocity update
    velocity_ += acceleration_ * dt;

    // To prevent moving backwards
    if (velocity_ < 0.0) {
        velocity_ = 0.0;
        acceleration_ = 0.0; // No further deceleration if the vehicle has stopped
    }
}

double VehicleModel::getVelocity() const {
    return velocity_;
}

double VehicleModel::getPosition() const {
    return position_;
}

double VehicleModel::getAcceleration() const {
    return acceleration_;
}