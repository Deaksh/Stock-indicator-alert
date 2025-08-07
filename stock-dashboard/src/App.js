import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, ReferenceDot, ReferenceLine
} from "recharts";
import {
  Box, Paper, Typography, TextField, Button, Checkbox,
  FormControlLabel, MenuItem, Alert, CircularProgress, Autocomplete,
  Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";

import ChatbotPanel from "./ChatbotPanel";
import UserMenu from "./UserMenu";
import Signup from "./Signup";
import Login from "./Login";

import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

import BuyCreditsModal from "./BuyCreditsModal";


const TIME_OPTIONS = [
  { label: "5 Minutes", period: "7d", interval: "5m" },
  { label: "15 Minutes", period: "60d", interval: "15m" },
  { label: "1 Day", period: "1mo", interval: "1d" },
  { label: "1 Month", period: "6mo", interval: "1d" },
  { label: "1 Year", period: "1y", interval: "1d" },
  { label: "5 Years", period: "5y", interval: "1wk" },
];

const AVAILABLE_INDICATORS = [
  { key: "sma20", label: "SMA 20" },
  { key: "ema20", label: "EMA 20" },
  { key: "rsi", label: "RSI" },
];

const BACKEND_URL = "https://stock-indicator-alert-1.onrender.com";

export default function App() {
  // Auth states
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(true);

  // Credits states
  const [credits, setCredits] = useState(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [creditsError, setCreditsError] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);

  // Main dashboard states
  const [symbol, setSymbol] = useState("AAPL");
  const [symbolInput, setSymbolInput] = useState("AAPL");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedTime, setSelectedTime] = useState(TIME_OPTIONS[2]);
  const [selectedIndicators, setSelectedIndicators] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  // UI state for welcome and buy credits dialogs
  const [showWelcome, setShowWelcome] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false); // For showing spinner during purchase

  // Latest indicator values for chat context
  const latestIndicatorValuesObj = data && data.length > 0 ? data[data.length - 1] : {};

  // Listen to auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // Fetch/register user and their credits after auth change
  useEffect(() => {
    async function fetchCredits(u) {
      if (!u) {
        setCredits(null);
        setCreditsError(null);
        setIsNewUser(false);
        return;
      }
      setLoadingCredits(true);
      try {
        const res = await fetch(`${BACKEND_URL}/register_user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: u.uid, email: u.email }),
        });
        if (!res.ok) throw new Error("Failed to fetch credits");
        const json = await res.json();
        setCredits(json.credits);
        setCreditsError(null);

        if (json.is_new) {
          setIsNewUser(true);
          setShowWelcome(true);
        } else {
          setIsNewUser(false);
        }
      } catch (e) {
        setCreditsError("Could not fetch credits. Some features may not work.");
        setCredits(null);
      }
      setLoadingCredits(false);
    }

    fetchCredits(user);
  }, [user]);

  // Debounced fetch for symbol suggestions
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const fetchSuggestions = useCallback(
    debounce(async (query) => {
      if (!query || query.length < 2) {
        setSuggestions([]);
        setLoadingSuggestions(false);
        return;
      }
      setLoadingSuggestions(true);
      try {
        const response = await fetch(
          `${BACKEND_URL}/symbols?q=${encodeURIComponent(query)}`
        );
        if (!response.ok) throw new Error("Failed to fetch suggestions");
        const json = await response.json();
        setSuggestions(json);
      } catch (err) {
        setSuggestions([]);
      }
      setLoadingSuggestions(false);
    }, 300),
    []
  );

  const onSymbolInputChange = (event, newInputValue, reason) => {
    if (reason === "input") {
      setSymbolInput(newInputValue.toUpperCase());
      fetchSuggestions(newInputValue);
    } else if (reason === "clear") {
      setSymbolInput("");
      setSuggestions([]);
    }
  };

  const onSymbolChange = (event, newValue) => {
    if (newValue) {
      if (typeof newValue === "string") {
        setSymbol(newValue.toUpperCase());
        setSymbolInput(newValue.toUpperCase());
      } else if (typeof newValue === "object" && newValue.symbol) {
        setSymbol(newValue.symbol.toUpperCase());
        setSymbolInput(newValue.symbol.toUpperCase());
      }
    }
  };

  const fetchStockData = async () => {
    if (!symbol) {
      setError("Please enter a stock symbol.");
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    const indicatorsParam = selectedIndicators.join(",");
    try {
      const url =
        `${BACKEND_URL}/history?symbol=${symbol}&period=${selectedTime.period}&interval=${selectedTime.interval}` +
        (indicatorsParam ? `&indicators=${indicatorsParam}` : "");
      const response = await fetch(url);
      const json = await response.json();
      if (json.error) setError(json.error);
      else if (Array.isArray(json)) setData(json);
      else setError("Unexpected data format from server");
    } catch (e) {
      setError("Failed to fetch data.");
    }
    setLoading(false);
  };

  const handleIndicatorChange = (e) => {
    const { value, checked } = e.target;
    setSelectedIndicators((prev) =>
      checked ? [...prev, value] : prev.filter((ind) => ind !== value)
    );
  };

  const formatDateToMMYYYY = (dateString) => {
    if (!dateString) return "";
    const [year, month] = dateString.split("-");
    return `${month}/${year}`;
  };

  // Handle closing welcome dialog
  const handleCloseWelcome = () => {
    setShowWelcome(false);
  };

  // Handle "Buy Credits" button click (opens buy credits modal)
  const handleOpenBuyCredits = () => {
    setShowBuyCredits(true);
  };

  const handleCloseBuyCredits = () => {
    if (!buyingCredits) setShowBuyCredits(false);
  };

  // Simulate credit purchase flow (replace with real payment logic)
  const handlePurchaseCredits = async (purchaseAmount = 10) => {
    setBuyingCredits(true);

    try {
      // Call your backend route to increment credits (example payload below)
      const res = await fetch(`${BACKEND_URL}/buy_credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, amount: purchaseAmount }),
      });
      if (!res.ok) throw new Error("Purchase failed");
      const data = await res.json();
      // Update credits in frontend state with server response
      setCredits(data.credits);
      setShowBuyCredits(false);
    } catch (e) {
      alert("Purchase failed, please try again.");
    }

    setBuyingCredits(false);
  };

  // Disable chat opening if user has zero credits
  useEffect(() => {
    if (credits === 0 && chatOpen) {
      setChatOpen(false);
      setShowBuyCredits(true);
    }
  }, [credits, chatOpen]);

  // Conditionally render signup/login if no user
  if (!user) {
    return (
      <div style={{ maxWidth: 420, margin: "48px auto", padding: 24 }}>
        {showLogin ? (
          <>
            <Login onSuccess={() => setShowLogin(false)} />
            <p style={{ marginTop: 18 }}>
              Need an account?&nbsp;
              <button
                onClick={() => setShowLogin(false)}
                style={{ cursor: "pointer", color: "#3557d5", background: "none", border: "none", padding: 0 }}
              >
                Sign up
              </button>
            </p>
          </>
        ) : (
          <>
            <Signup onSuccess={() => setShowLogin(true)} />
            <p style={{ marginTop: 18 }}>
              Already have an account?&nbsp;
              <button
                onClick={() => setShowLogin(true)}
                style={{ cursor: "pointer", color: "#3557d5", background: "none", border: "none", padding: 0 }}
              >
                Log in
              </button>
            </p>
          </>
        )}
      </div>
    );
  }

  // Logged in dashboard
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f7f9fb",
        pt: 3.5,
        pb: 6,
        fontFamily: "'Inter', 'Roboto', Arial, sans-serif",
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto", px: 2 }}>
        <Paper
          elevation={4}
          sx={{
            borderRadius: 4,
            p: { xs: 2, md: 4 },
            mb: 4,
            boxShadow: 6,
            transition: "box-shadow .18s",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Typography
              variant="h4"
              fontWeight={800}
              color="#24344d"
              sx={{ letterSpacing: "-1.2px" }}
            >
              <span style={{ color: "#3557d5", marginRight: 9 }}>
                Market Master
              </span>
              Dashboard
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Typography variant="body2" fontWeight="bold" color="textSecondary" sx={{userSelect:"none"}}>
                {loadingCredits
                  ? "Credits: ..."
                  : credits !== null
                    ? `Credits: ${credits}`
                    : ""}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={handleOpenBuyCredits}
                disabled={loadingCredits}
                sx={{ textTransform: "none" }}
              >
                Buy Credits
              </Button>
              <UserMenu user={user} />
            </Box>
          </Box>

          {/* Controls */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              mb: 4,
              flexWrap: "wrap",
            }}
          >
            <Autocomplete
              freeSolo
              disableClearable
              options={suggestions}
              getOptionLabel={(option) =>
                typeof option === "string"
                  ? option
                  : `${option.symbol} - ${option.name}`
              }
              filterOptions={(x) => x}
              inputValue={symbolInput}
              onInputChange={onSymbolInputChange}
              onChange={onSymbolChange}
              loading={loadingSuggestions}
              sx={{ width: 180, background: "#fafbfc", borderRadius: 2 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Symbol"
                  size="small"
                  variant="outlined"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingSuggestions ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            <TextField
              select
              label="Period"
              size="small"
              variant="outlined"
              value={selectedTime.label}
              onChange={(e) => {
                const opt = TIME_OPTIONS.find((opt) => opt.label === e.target.value);
                if (opt) setSelectedTime(opt);
              }}
              sx={{ width: 140, background: "#fafbfc", borderRadius: 2 }}
            >
              {TIME_OPTIONS.map(({ label }) => (
                <MenuItem key={label} value={label}>
                  {label}
                </MenuItem>
              ))}
            </TextField>

            <Button
              variant="contained"
              color="primary"
              onClick={fetchStockData}
              disabled={loading}
              sx={{
                px: 4,
                py: 1.2,
                fontWeight: "bold",
                fontSize: 17,
                letterSpacing: "1px",
                boxShadow: 2,
              }}
            >
              {loading ? "Loading..." : "Fetch Data"}
            </Button>
          </Box>

          {/* Indicators */}
          <Box
            sx={{
              bgcolor: "#f6f8ff",
              borderRadius: 2,
              py: 1.5,
              px: 2.5,
              mb: 3,
              border: "1px solid #e7eaf4",
              display: "flex",
              alignItems: "center",
              gap: 3,
              flexWrap: "wrap",
            }}
          >
            <Typography fontWeight={700} fontSize={17} sx={{ mr: 2 }}>
              Indicators:
            </Typography>
            {AVAILABLE_INDICATORS.map(({ key, label }) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={selectedIndicators.includes(key)}
                    onChange={handleIndicatorChange}
                    value={key}
                    sx={{
                      color: "#3557d5",
                      "&.Mui-checked": { color: "#3557d5" },
                    }}
                  />
                }
                label={label}
                sx={{ mr: 1, fontWeight: 500, fontSize: 16 }}
              />
            ))}
          </Box>

          {/* Error */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Charts */}
          {data && data.length > 0 && (
            <>
              <ResponsiveContainer width="100%" height={330}>
                <LineChart
                  data={data}
                  margin={{ top: 20, right: 40, bottom: 20, left: 20 }}
                >
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateToMMYYYY}
                    minTickGap={20}
                  />
                  <YAxis yAxisId="left" domain={["dataMin", "dataMax"]} />
                  <Tooltip />
                  <Legend
                    verticalAlign="top"
                    height={37}
                    wrapperStyle={{
                      background: "#fff",
                      borderRadius: 7,
                      boxShadow: "0 2px 9px #0001",
                      padding: "4px 12px",
                    }}
                  />
                  <CartesianGrid stroke="#e4e8f4" />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="close"
                    stroke="#3557d5"
                    name={`${symbol} Close`}
                    strokeWidth={2.5}
                    dot={false}
                  />
                  {selectedIndicators.includes("sma20") && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="SMA_20"
                      stroke="#47ba76"
                      name="SMA 20"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                  {selectedIndicators.includes("ema20") && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="EMA_20"
                      stroke="#f6973b"
                      name="EMA 20"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                  {/* Gap Up/Down markers */}
                  {data.map((d, i) =>
                    d.gap_up ? (
                      <ReferenceDot
                        key={`gapup-${i}`}
                        x={d.date}
                        y={d.close}
                        r={9}
                        fill="#2ed6a1"
                        stroke="#fff"
                        strokeWidth={2}
                        label={{
                          value: "Gap Up",
                          position: "top",
                          fill: "#059c6c",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      />
                    ) : d.gap_down ? (
                      <ReferenceDot
                        key={`gapdown-${i}`}
                        x={d.date}
                        y={d.close}
                        r={9}
                        fill="#e74c3c"
                        stroke="#fff"
                        strokeWidth={2}
                        label={{
                          value: "Gap Down",
                          position: "bottom",
                          fill: "#e74c3c",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      />
                    ) : null
                  )}
                  {data.map((d, i) =>
                    d.swing_high ? (
                      <ReferenceDot
                        key={`swinghigh-${i}`}
                        x={d.date}
                        y={d.close}
                        r={6}
                        fill="#3093d9"
                        stroke="#fff"
                        label={{
                          value: "Swing High",
                          position: "top",
                          fill: "#3093d9",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      />
                    ) : d.swing_low ? (
                      <ReferenceDot
                        key={`swinglow-${i}`}
                        x={d.date}
                        y={d.close}
                        r={6}
                        fill="#ffd66b"
                        stroke="#fff"
                        label={{
                          value: "Swing Low",
                          position: "bottom",
                          fill: "#bba710",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      />
                    ) : null
                  )}
                </LineChart>
              </ResponsiveContainer>

              <Box mt={3} bgcolor="#f5f9fb" borderRadius={2} pb={0.2}>
                <ResponsiveContainer width="100%" height={95}>
                  <BarChart data={data} margin={{ left: 40, right: 40 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateToMMYYYY}
                      minTickGap={20}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="volume" fill="#9fb9f7" name="Volume" radius={7} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>

              {/* RSI Chart */}
              {selectedIndicators.includes("rsi") &&
                data.some((d) => d.RSI_14 !== undefined) && (
                  <Box mt={3} bgcolor="#f7f9fc" borderRadius={2} py={2}>
                    <Typography
                      color="#9254de"
                      fontWeight={600}
                      fontSize={17}
                      ml={3}
                      mb={-2}
                    >
                      RSI (14) Indicator
                    </Typography>
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart
                        data={data}
                        margin={{ left: 40, right: 40, bottom: 0, top: 12 }}
                      >
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatDateToMMYYYY}
                          minTickGap={20}
                        />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend verticalAlign="top" height={32} />
                        <CartesianGrid stroke="#eceffa" />
                        <ReferenceLine
                          y={70}
                          stroke="#e74c3c"
                          strokeDasharray="3 3"
                          label="Overbought (70)"
                        />
                        <ReferenceLine
                          y={30}
                          stroke="#47ba76"
                          strokeDasharray="3 3"
                          label="Oversold (30)"
                        />
                        <Line
                          type="monotone"
                          dataKey="RSI_14"
                          stroke="#9254de"
                          name="RSI 14"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                )}
            </>
          )}

        </Paper>
      </Box>

      <BuyCreditsModal
        open={showBuyCredits}
        onClose={() => setShowBuyCredits(false)}
        uid={user.uid}
        onCreditsUpdated={setCredits}
        email={user.email}
        contact={user.phoneNumber ?? ""}
       />

      {/* Chatbot Panel */}
      <ChatbotPanel
        open={chatOpen}
        setOpen={setChatOpen}
        user={user}
        symbol={symbol}
        indicatorValues={latestIndicatorValuesObj}
        selectedTime={selectedTime}
        selectedIndicators={selectedIndicators}
        credits={credits}
        setCredits={setCredits}
        botName="Maven AI"
        onOutOfCredits={() => setShowBuyCredits(true)}
      />

      {/* Welcome Dialog */}
      <Dialog open={showWelcome} onClose={handleCloseWelcome}>
        <DialogTitle>Welcome, {user?.email}!</DialogTitle>
        <DialogContent>
          <Typography>
            You’ve received {credits !== null ? credits : "some"} free AI credits to get started. Enjoy exploring AI-powered insights with Maven!
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWelcome} autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
