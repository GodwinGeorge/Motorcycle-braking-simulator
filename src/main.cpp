#include "vehicleModel.hpp"

#include "crow.h"

#include <algorithm>
#include <cmath>
#include <iostream>
#include <random>
#include <string>
#include <vector>

struct SimulationPoint
{
    double time;
    double velocity;
    double acceleration;
    double position;
};

struct SensorSample
{
    double time;
    double frontWheelSpeed;
    double rearWheelSpeed;
    double longitudinalAcceleration;
    double lateralAcceleration;
    double verticalAcceleration;
    double rollRate;
    double pitchRate;
    double yawRate;
    double gpsLatitude;
    double gpsLongitude;
    double gpsSpeed;
    bool gpsFix;
};


int main()
{
    crow::SimpleApp app;

    CROW_ROUTE(app, "/simulate").methods("OPTIONS"_method)
        ([]()
        {
            crow::response response;
            response.add_header("Access-Control-Allow-Origin", "*");
            response.add_header("Access-Control-Allow-Methods", "POST, OPTIONS");
            response.add_header("Access-Control-Allow-Headers", "Content-Type");
            return response;
        });

    CROW_ROUTE(app, "/")
        ([]()
        {
            crow::response response;

            response.set_static_file_info(
                "web/index.html"
            );

            return response;
        });
    CROW_ROUTE(app, "/style.css")
([]()
{
    crow::response response;

    response.set_static_file_info(
        "web/style.css"
    );

    return response;
});


    CROW_ROUTE(app, "/scripts.js")
    ([]()
    {
        crow::response response;

        response.set_static_file_info(
        "web/scripts.js"
        );

        return response;
    });

    CROW_ROUTE(app, "/simulate")
        .methods(crow::HTTPMethod::POST)
        ([](const crow::request& request)
        {
            auto body = crow::json::load(request.body);

            if (!body)
            {
                return crow::response(
                    400,
                    "Invalid JSON"
                );
            }


            // Read inputs from webpage

            double mass =
                body["mass"].d();

            double initialSpeedKmh =
                body["speed"].d();

            double friction =
                body["friction"].d();

            double brakeForce =
                body["brakeForce"].d();

            double sensorNoise = body["sensorNoise"].d();
            double gpsNoise = body["gpsNoise"].d();
            double wheelRadius = body["wheelRadius"].d();
            double sensorRate = body["sensorRate"].d();
            double leanAngle = body["leanAngle"].d();
            double frontBrakeBias = body["frontBrakeBias"].d();
            bool absEnabled = body["absEnabled"].b();

            if (sensorNoise <= 0.0) sensorNoise = 0.02;
            if (gpsNoise <= 0.0) gpsNoise = 1.5;
            if (wheelRadius <= 0.0) wheelRadius = 0.31;
            if (sensorRate <= 0.0) sensorRate = 100.0;
            sensorRate = std::clamp(sensorRate, 10.0, 100.0);
            leanAngle = std::clamp(leanAngle, 0.0, 60.0);
            frontBrakeBias = std::clamp(frontBrakeBias, 0.0, 100.0);


            // Convert km/h → m/s

            double initialSpeed =
                initialSpeedKmh / 3.6;


            constexpr double DT = 0.01;


            // Create vehicle

            constexpr double GRAVITY = 9.81;
            constexpr double PI = 3.14159265358979323846;
            constexpr double REFERENCE_RADIUS = 0.31;
            constexpr double REFERENCE_CG_HEIGHT = 0.62;
            const double cgHeight = REFERENCE_CG_HEIGHT + (wheelRadius - REFERENCE_RADIUS);
            const double leanLimit = std::atan(REFERENCE_CG_HEIGHT / cgHeight) * 180.0 / PI;
            const bool fallen = leanAngle > leanLimit;
            const double leanGrip = std::max(0.05, std::cos(leanAngle * PI / 180.0));
            const double wheelMass = mass * 0.04;
            const double referenceWheelInertia = 0.5 * wheelMass * REFERENCE_RADIUS * REFERENCE_RADIUS;
            const double effectiveMass = mass + (2.0 * referenceWheelInertia) / (wheelRadius * wheelRadius);
            const double maximumBrakeForce = friction * mass * GRAVITY * leanGrip;
            const double requestedFrontForce = brakeForce * frontBrakeBias / 100.0;
            const double requestedRearForce = brakeForce - requestedFrontForce;
            const double frontLoad = mass * GRAVITY * 0.62;
            const double rearLoad = mass * GRAVITY - frontLoad;
            const double frontLimit = friction * leanGrip * frontLoad;
            const double rearLimit = friction * leanGrip * rearLoad;
            const double manualScale = brakeForce > maximumBrakeForce
                ? maximumBrakeForce * 0.7 / brakeForce
                : 1.0;
            const double actualFrontForce = absEnabled
                ? std::min(requestedFrontForce, frontLimit)
                : requestedFrontForce * manualScale;
            const double actualRearForce = absEnabled
                ? std::min(requestedRearForce, rearLimit)
                : requestedRearForce * manualScale;
            const double actualBrakeForce = std::min(actualFrontForce + actualRearForce, maximumBrakeForce);
            const bool absActive = absEnabled && (actualFrontForce < requestedFrontForce || actualRearForce < requestedRearForce);

            VehicleModel vehicle(
                mass,
                friction * leanGrip,
                effectiveMass
            );

            vehicle.setInitialVelocity(
                initialSpeed
            );


            // Calculate maximum available brake force

            const double deceleration = actualBrakeForce / mass;


            std::vector<SimulationPoint> data;
            std::vector<SensorSample> sensors;
            std::normal_distribution<double> sensorError(0.0, sensorNoise);
            std::normal_distribution<double> gpsError(0.0, gpsNoise);
            std::mt19937 random(42);
            double lastGpsLatitude = 51.5074;
            double lastGpsLongitude = -0.1278;
            double lastGpsSpeed = initialSpeed;


            double time = 0.0;


            // Run simulation

            while (vehicle.getVelocity() > 0.0)
            {
                vehicle.update(
                    DT,
                    actualBrakeForce
                );

                time += DT;


                data.push_back(
                    {
                        time,
                        vehicle.getVelocity(),
                        vehicle.getAcceleration(),
                        vehicle.getPosition()
                    }
                );

                const double speed = vehicle.getVelocity();
                const double brakingRatio = deceleration > 0.0
                    ? std::clamp(std::abs(vehicle.getAcceleration()) / deceleration, 0.0, 1.0)
                    : 0.0;
                const double frontLoadFactor = 1.0 + 0.12 * brakingRatio;
                const double rearLoadFactor = 1.0 - 0.08 * brakingRatio;
                const bool sensorSample = std::fmod(time, 1.0 / sensorRate) < DT;
                const bool gpsSample = std::fmod(time, 1.0) < DT;

                if (sensorSample || sensors.empty())
                {
                    if (gpsSample || sensors.empty())
                    {
                        const double gpsPositionNoise = gpsError(random);
                        lastGpsLatitude = 51.5074 + gpsPositionNoise / 111111.0;
                        lastGpsLongitude = -0.1278 + (vehicle.getPosition() + gpsPositionNoise) / 69400.0;
                        lastGpsSpeed = std::max(0.0, speed + gpsError(random) * 0.05);
                    }
                    sensors.push_back(
                        {
                            time,
                            std::max(0.0, speed / wheelRadius + sensorError(random)),
                            std::max(0.0, speed / wheelRadius + sensorError(random)),
                            vehicle.getAcceleration() + sensorError(random),
                            sensorError(random) * 0.25,
                            9.81 + sensorError(random) * 0.5,
                            sensorError(random) * 0.1,
                            -std::abs(vehicle.getAcceleration()) * 0.015 + sensorError(random) * 0.1,
                            sensorError(random) * 0.1,
                            lastGpsLatitude,
                            lastGpsLongitude,
                            lastGpsSpeed,
                            true
                        }
                    );
                }
            }


            // Build JSON response

            crow::json::wvalue response;


            response["stoppingTime"] =
                time;

            response["stoppingDistance"] =
                vehicle.getPosition();

            response["maxDeceleration"] =
                actualBrakeForce / mass;

            response["deceleration"] =
                -deceleration;

            response["actualBrakeForce"] =
                actualBrakeForce;

            response["absActive"] = absActive;
            response["frontBrakeForce"] = actualFrontForce;
            response["rearBrakeForce"] = actualRearForce;
            response["fallen"] = fallen;
            response["leanLimit"] = leanLimit;
            response["effectiveMass"] = effectiveMass;


            // Simulation data

            crow::json::wvalue dataArray;

            int index = 0;

            for (const auto& point : data)
            {
                crow::json::wvalue item;

                item["time"] =
                    point.time;

                item["velocity"] =
                    point.velocity;

                item["acceleration"] =
                    point.acceleration;

                item["position"] =
                    point.position;

                dataArray[index++] =
                    std::move(item);
            }


            response["data"] =
                std::move(dataArray);

            crow::json::wvalue sensorArray;
            int sensorIndex = 0;
            for (const auto& sample : sensors)
            {
                crow::json::wvalue item;
                item["time"] = sample.time;
                item["frontWheelSpeed"] = sample.frontWheelSpeed;
                item["rearWheelSpeed"] = sample.rearWheelSpeed;
                item["longitudinalAcceleration"] = sample.longitudinalAcceleration;
                item["lateralAcceleration"] = sample.lateralAcceleration;
                item["verticalAcceleration"] = sample.verticalAcceleration;
                item["rollRate"] = sample.rollRate;
                item["pitchRate"] = sample.pitchRate;
                item["yawRate"] = sample.yawRate;
                item["gpsLatitude"] = sample.gpsLatitude;
                item["gpsLongitude"] = sample.gpsLongitude;
                item["gpsSpeed"] = sample.gpsSpeed;
                item["gpsFix"] = sample.gpsFix;
                sensorArray[sensorIndex++] = std::move(item);
            }
            response["sensors"] = std::move(sensorArray);


            crow::response result(std::move(response));
            result.add_header("Access-Control-Allow-Origin", "*");
            result.add_header("Access-Control-Allow-Methods", "POST, OPTIONS");
            result.add_header("Access-Control-Allow-Headers", "Content-Type");
            return result;
        });


    std::cout
        << "Vehicle Braking Simulator\n";

    std::cout
        << "Server running at:\n";

    std::cout
        << "http://localhost:18080\n";


    app.port(18080)
       .multithreaded()
       .run();
}
