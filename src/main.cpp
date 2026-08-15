#include "vehicleModel.hpp"

#include "crow.h"

#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct SimulationPoint
{
    double time;
    double velocity;
    double acceleration;
    double position;
};


int main()
{
    crow::SimpleApp app;
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


    CROW_ROUTE(app, "/script.js")
    ([]()
    {
        crow::response response;

        response.set_static_file_info(
            "web/script.js"
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


            // Convert km/h → m/s

            double initialSpeed =
                initialSpeedKmh / 3.6;


            constexpr double DT = 0.01;


            // Create vehicle

            VehicleModel vehicle(
                mass,
                friction
            );

            vehicle.setInitialVelocity(
                initialSpeed
            );


            // Calculate maximum available brake force

            constexpr double GRAVITY = 9.81;

            double maximumBrakeForce =
                friction *
                mass *
                GRAVITY;


            double actualBrakeForce =
                std::min(
                    brakeForce,
                    maximumBrakeForce
                );


            std::vector<SimulationPoint> data;


            double time = 0.0;


            // Run simulation

            while (vehicle.getVelocity() > 0.0)
            {
                vehicle.update(
                    DT,
                    brakeForce
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
            }


            // Build JSON response

            crow::json::wvalue response;


            response["stoppingTime"] =
                time;

            response["stoppingDistance"] =
                vehicle.getPosition();

            response["maxDeceleration"] =
                actualBrakeForce / mass;

            response["actualBrakeForce"] =
                actualBrakeForce;


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


            return crow::response(
                std::move(response)
            );
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