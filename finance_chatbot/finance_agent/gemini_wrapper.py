import os
import json
import inspect
import logging
from dotenv import load_dotenv
from typing import Any, Dict, List, Callable, Optional
from google.generativeai.types import GenerationConfig
import google.generativeai as genai

logger = logging.getLogger(__name__)

load_dotenv()
GEMINI_API_KEY_ENV = "GEMINI_API_KEY"

USE_REAL = bool(os.getenv(GEMINI_API_KEY_ENV, "").strip())

if USE_REAL:
    try:
        genai.configure(api_key=os.getenv(GEMINI_API_KEY_ENV))
    except Exception as e:
        logger.warning("Failed to import google.generativeai - falling back to MOCK. Error: %s", e)
        USE_REAL = False


def _callable_to_schema(func: Callable) -> Dict:
    """
    Build a simple JSON schema for function parameters based on signature.
    Defaults to string for unknown annotations.
    """
    sig = inspect.signature(func)
    props = {}
    required = []
    for name, param in sig.parameters.items():
        if param.kind in (param.VAR_POSITIONAL, param.VAR_KEYWORD):
            continue
        ann = param.annotation
        if ann == inspect._empty:
            t = "string"
        elif ann in (str,):
            t = "string"
        elif ann in (int,):
            t = "integer"
        elif ann in (float,):
            t = "number"
        elif ann in (bool,):
            t = "boolean"
        else:
            t = "string"
        props[name] = {"type": t, "description": f"Parameter {name} of {func.__name__}"}
        if param.default == inspect._empty:
            required.append(name)
    schema = {"type": "object", "properties": props}
    if required:
        schema["required"] = required
    return schema


class GeminiWrapper:
    """
    Wrapper: if GEMINI_API_KEY provided and google.generativeai importable -> real calls
    Otherwise uses a deterministic MOCK LLM for dev / testing.
    """

    def __init__(self, model: str = "gemini-2.0-flash"):
        self.model_name = model
        self.use_real = USE_REAL
        if self.use_real:
            try:
                self.model = genai.GenerativeModel(model)
            except Exception as e:
                logger.error("Failed to init GenerativeModel: %s", e)
                self.use_real = False
                self.model = None
        else:
            self.model = None

    def _build_functions_metadata(self, tools: List[Callable]) -> List[Dict]:
        metas = []
        for t in tools:
            metas.append(
                {
                    "name": getattr(t, "__name__", str(t)),
                    "description": (t.__doc__ or "").strip(),
                    "parameters": _callable_to_schema(t),
                }
            )
        return metas

    def _mock_generate(self, messages: List[Dict], tools: Optional[List[Callable]] = None) -> Dict[str, Any]:
        """
        A very small deterministic mock LLM.
        """
        joined = " ".join(m.get("content", "") for m in messages).lower()
        out = {"text": None, "function_call": None, "raw": None}

        # detect subquestion generation intent
        if "json array of subquestions" in joined or "json list of subquestions" in joined:
            json_out = {"subquestions": [
                {"id": 1, "question": "What is the ticker for FPT?", "depends_on": []},
                {"id": 2, "question": "What is the current price of {{TICKER_FROM_Q1}}?", "depends_on": [1]}
            ]}
            out["text"] = json.dumps(json_out)
            return out

        # detect tool request and generate appropriate arguments
        if tools and len(tools) > 0:
            tool = tools[0]
            tool_name = getattr(tool, "__name__", None)
            
            if tool_name:
                # Generate appropriate arguments based on tool name
                arguments = {}
                
                # Extract company/ticker names from query
                # Common Vietnamese stock codes
                vn_stocks = ["fpt", "vcb", "hpg", "vnm", "mwg", "vhm", "tpb", "tcb", "bid", "ctg", "vib"]
                found_stock = None
                for stock in vn_stocks:
                    if stock in joined:
                        found_stock = stock.upper()
                        break
                
                # Map tool names to their expected arguments
                if tool_name == "get_stock_symbol":
                    # Extract company name from query
                    company = found_stock or "FPT"
                    arguments = {"company_name": company}
                    
                elif tool_name in ["get_stock_price", "get_fundamentals", "get_sector_mapping", 
                                  "calculate_ratios", "estimate_fair_value", "analyze_cashflow",
                                  "get_technical_indicators", "get_risk_metrics", "generate_price_chart",
                                  "get_income_statement", "get_balance_sheet", "get_pattern_recognition",
                                  "get_candlestick_analysis", "get_signal_summary", "get_advanced_ratios"]:
                    ticker = f"{found_stock}.VN" if found_stock else "FPT.VN"
                    arguments = {"ticker": ticker}
                    
                elif tool_name == "get_exchange_info":
                    if "hose" in joined:
                        arguments = {"exchange": "HOSE"}
                    elif "hnx" in joined:
                        arguments = {"exchange": "HNX"}
                    else:
                        arguments = {"exchange": "HOSE"}
                        
                elif tool_name == "get_currency_rate":
                    # Extract currency codes
                    from_curr = "USD"
                    to_curr = "VND"
                    if "usd" in joined:
                        from_curr = "USD"
                    if "vnd" in joined or "việt nam" in joined:
                        to_curr = "VND"
                    arguments = {"from_currency": from_curr, "to_currency": to_curr, "amount": 1.0}
                    
                elif tool_name == "get_macro_data":
                    country = "Vietnam" if "việt nam" in joined or "vietnam" in joined else "US"
                    # Map Vietnamese terms to indicators
                    if "lạm phát" in joined or "inflation" in joined or "cpi" in joined:
                        indicator = "inflation_cpi"
                    elif "gdp" in joined:
                        indicator = "gdp"
                    elif "thất nghiệp" in joined or "unemployment" in joined:
                        indicator = "unemployment"
                    elif "lãi suất" in joined or "interest" in joined:
                        indicator = "interest_rate"
                    else:
                        indicator = "gdp"
                    arguments = {"country": country, "indicator": indicator}
                    
                elif tool_name == "google_search" or tool_name == "search_news":
                    # Extract search query
                    query = "FPT stock news" if found_stock else "stock market news"
                    arguments = {"query": query}
                    
                elif tool_name == "compare_fundamentals" or tool_name == "compare_with_peers":
                    # Need multiple tickers
                    tickers = ["FPT.VN", "MWG.VN", "VCB.VN"]
                    arguments = {"tickers": tickers}
                    
                elif tool_name == "get_correlation_matrix":
                    tickers = ["FPT.VN", "MWG.VN", "VCB.VN"]
                    arguments = {"tickers": tickers, "period": "1y"}
                    
                elif tool_name == "analyze_portfolio":
                    portfolio = {"FPT.VN": 0.4, "MWG.VN": 0.3, "VCB.VN": 0.3}
                    arguments = {"portfolio": portfolio}
                    
                else:
                    # Default fallback
                    arguments = {"ticker": "FPT.VN"}
                
                out["function_call"] = {"name": tool_name, "arguments": arguments}
                return out

        out["text"] = "[-] Mock answer: cannot do complex reasoning in mock mode."
        return out

    def generate(
        self,
        messages: List[Dict],
        tools: Optional[List[Callable]] = None,
        temperature: float = 0.0,
        max_output_tokens: int = 1024,
        function_call: str = "auto"
    ) -> Dict[str, Any]:
        """
        Gọi model Gemini hoặc mock.
        Trả về dict: {'text': str|None, 'function_call': dict|None, 'raw': raw_response}
        """
        if not self.use_real or not self.model:
            return self._mock_generate(messages, tools)

        try:
            # gom tất cả messages thành chuỗi cho Gemini
            user_input = "\n".join([f"{m['role']}: {m['content']}" for m in messages])

            resp = self.model.generate_content(
                user_input,
                generation_config=GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=max_output_tokens
                )
            )

            out = {"text": None, "function_call": None, "raw": resp}
            out["text"] = getattr(resp, "text", None)
            return out

        except Exception as e:
            logger.error("Error calling real Gemini SDK: %s. Falling back to MOCK.", e)
            return self._mock_generate(messages, tools)

    async def agenerate(self, *args, **kwargs):
        import asyncio
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self.generate(*args, **kwargs))
