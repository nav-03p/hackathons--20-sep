#pragma once
#include "cost.h"
namespace wlo {
inline double openFixedCost(const std::vector<Candidate>& M, const std::vector<int>& open);
inline bool openFeasible(const std::vector<Candidate>& M, const std::vector<int>& open, const Params& p);
inline bool hasOpen(const std::vector<int>& o,int j);
inline Solution assignGreedy(const std::vector<Neighborhood>& N,
    const std::vector<Candidate>& M, const std::vector<int>& open,
    const Params& p, const Matrices& mx, const std::string& algo);
}
