#include <algorithm>
#include "crow.h"
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

        const double g = 9.81;
        double v0 = speed_kmh / 3.6;
        double maxBrakeForce = friction * mass * g;
        double actualBrakeForce = std::min(brakeForce, maxBrakeForce);
        double deceleration = actualBrakeForce / mass;

        double stoppingTime = v0 / deceleration;
        double stoppingDistance = (v0 * v0) / (2.0 * deceleration);

        crow::json::wvalue res;
        res["stoppingTime"] = stoppingTime;
        res["stoppingDistance"] = stoppingDistance;
        res["deceleration"] = -deceleration;
        res["actualBrakeForce"] = actualBrakeForce;

        crow::response resp{res};
        resp.add_header("Access-Control-Allow-Origin", "*");
        resp.add_header("Access-Control-Allow-Methods", "POST, OPTIONS");
        resp.add_header("Access-Control-Allow-Headers", "Content-Type");
        return resp;
    });

    app.port(18080).multithreaded().run();
    return 0;
}
