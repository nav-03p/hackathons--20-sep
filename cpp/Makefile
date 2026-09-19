CXX ?= g++
STD = -std=c++17
OPT = -O2
INC = -I include
BIN = wlopt
SRC = src/main.cpp

all: $(BIN)

$(BIN): $(SRC) include/*.h
	$(CXX) $(STD) $(OPT) $(INC) $(SRC) -o $(BIN)

test: $(BIN)
	./run_tests.sh

clean:
	rm -f $(BIN)

.PHONY: all test clean
