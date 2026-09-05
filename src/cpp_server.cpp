#include <algorithm>
#include "crow.h"
#include "vehicleModel.hpp"
#include <fstream>
#include <sstream>
#include <sys/stat.h>

int main()
{
    crow::SimpleApp app;

    // Helper: serve static files from web/ directory
    auto file_exists = [](const std::string &path) {
        struct stat buf;
        return (stat(path.c_str(), &buf) == 0);
    };

    auto content_type = [](const std::string &path) {
        if (path.size() >= 5 && path.substr(path.size()-5) == ".html") return "text/html";
        if (path.size() >= 3 && path.substr(path.size()-3) == ".js") return "text/javascript";
        if (path.size() >= 4 && path.substr(path.size()-4) == ".css") return "text/css";
        if (path.size() >= 4 && path.substr(path.size()-4) == ".png") return "image/png";
        if (path.size() >= 4 && path.substr(path.size()-4) == ".jpg") return "image/jpeg";
        return "application/octet-stream";
    };

    auto serve_file = [&](const std::string &rel_path) {
        std::string path = std::string("web/") + rel_path;
        if (!file_exists(path)) {
            return crow::response(404);
        }
        std::ifstream in(path, std::ios::binary);
        std::ostringstream ss;
        ss << in.rdbuf();
        crow::response res(ss.str());
        res.add_header("Content-Type", content_type(path));
        return res;
    };

    CROW_ROUTE(app, "/").methods("GET"_method)([&](){
        return serve_file("index.html");
    });

    CROW_ROUTE(app, "/<string>").methods("GET"_method)([&](const std::string &p){
        return serve_file(p);
    });

    // CORS preflight handler for /simulate
    CROW_ROUTE(app, "/simulate").methods("OPTIONS"_method)([](){
        crow::response r;
        r.add_header("Access-Control-Allow-Origin", "*");
        r.add_header("Access-Control-Allow-Methods", "POST, OPTIONS");
        r.add_header("Access-Control-Allow-Headers", "Content-Type");
        return r;
    });

    CROW_ROUTE(app, "/simulate").methods("POST"_method)([](const crow::request& req){
        auto r = crow::json::load(req.body);
        if (!r)
            return crow::response(400);

        double mass = r["mass"].d();
        double speed_kmh = r["speed"].d();
        double friction = r["friction"].d();
        double brakeForce = r["brakeForce"].d();
        double wheelRadius = r["wheelRadius"].d();
        double leanAngle = r["leanAngle"].d();
        double frontBrakeBias = r["frontBrakeBias"].d();
        double reactionTime = r["reactionTime"].d();
        double dogDistance = r["dogDistance"].d();
        bool dogEnabled = r["dogEnabled"].b();
        bool rearWheelLiftRequested = r["rearWheelLiftRequested"].b();
        bool absEnabled = r["absEnabled"].b();
        reactionTime = std::clamp(reactionTime, 0.0, 5.0);
        dogDistance = std::clamp(dogDistance, 1.0, 200.0);
        const bool liftPreventedByAbs = rearWheelLiftRequested && absEnabled;
        if (absEnabled) rearWheelLiftRequested = false;

        const double g = 9.81;
        double v0 = speed_kmh / 3.6;
        const double leanGrip = std::max(0.05, std::cos(leanAngle * 3.141592653589793 / 180.0));
        const double cgHeight = 0.62 + wheelRadius - 0.31;
        double velocity = v0;
        double stoppingTime = 0.0;
        double stoppingDistance = 0.0;
        double acceleration = 0.0;
        BrakingForces forces{mass * g / 2.0, mass * g / 2.0, 0.0, 0.0, false, false};
        while (velocity > 0.0 && stoppingTime < 300.0) {
            forces = calculateBrakingForces(mass, brakeForce, friction, leanGrip, frontBrakeBias, absEnabled, rearWheelLiftRequested, acceleration, cgHeight, 1.4);
            const double actualBrakeForce = forces.frontForce + forces.rearForce;
            acceleration = -actualBrakeForce / mass;
            stoppingDistance += std::max(0.0, velocity * 0.01 + 0.5 * acceleration * 0.0001);
            velocity = std::max(0.0, velocity + acceleration * 0.01);
            stoppingTime += 0.01;
        }
        const double actualBrakeForce = forces.frontForce + forces.rearForce;
        const double reactionDistance = v0 * reactionTime;

        crow::json::wvalue res;
        res["stoppingTime"] = stoppingTime;
        res["stoppingDistance"] = stoppingDistance;
        res["totalStoppingDistance"] = stoppingDistance + reactionDistance;
        res["reactionTime"] = reactionTime;
        res["reactionDistance"] = reactionDistance;
        res["deceleration"] = -(v0 / stoppingTime);
        const double brakingDeceleration = stoppingDistance > 0.0 ? (v0 * v0) / (2.0 * stoppingDistance) : 0.0;
        const bool dogHit = dogEnabled && dogDistance <= stoppingDistance + reactionDistance;
        const double distanceAfterReaction = std::max(0.0, dogDistance - reactionDistance);
        res["dogDistance"] = dogDistance;
        res["dogEnabled"] = dogEnabled;
        res["dogHit"] = dogHit;
        res["impactSpeedKmh"] = dogHit
            ? std::sqrt(std::max(0.0, v0 * v0 - 2.0 * brakingDeceleration * distanceAfterReaction)) * 3.6
            : 0.0;
        res["rearWheelLiftRequested"] = rearWheelLiftRequested;
        res["rearWheelLiftPreventedByAbs"] = liftPreventedByAbs;
        res["actualBrakeForce"] = actualBrakeForce;
        res["frontBrakeForce"] = forces.frontForce;
        res["rearBrakeForce"] = forces.rearForce;
        res["frontLoad"] = forces.frontLoad;
        res["rearLoad"] = forces.rearLoad;
        res["rearWheelLift"] = forces.rearWheelLift;
        res["absActive"] = forces.absActive;
        res["model"] = "load-transfer-v1";

        crow::response resp{res};
        resp.add_header("Access-Control-Allow-Origin", "*");
        resp.add_header("Access-Control-Allow-Methods", "POST, OPTIONS");
        resp.add_header("Access-Control-Allow-Headers", "Content-Type");
        return resp;
    });

    app.port(18080).multithreaded().run();
    return 0;
}
